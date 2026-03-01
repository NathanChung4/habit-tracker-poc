-- Initial schema for PatternFinder habit tracker MVP.

create extension if not exists pgcrypto;

create type habit_schedule_type as enum ('daily', 'weekdays', 'custom_days', 'times_per_week');
create type habit_instance_status as enum ('pending', 'done', 'missed');
create type reward_rule_type as enum ('completion_threshold');
create type reward_unlock_status as enum ('locked', 'unlocked', 'redeemed');

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  timezone text not null default 'America/Chicago',
  day_cutoff_minutes integer not null default 0 check (day_cutoff_minutes between 0 and 1439),
  streak_threshold numeric(4,3) not null default 0.8 check (streak_threshold between 0 and 1),
  streak_count integer not null default 0,
  streak_protection_tokens integer not null default 2 check (streak_protection_tokens >= 0),
  xp integer not null default 0,
  level integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  notes text,
  schedule_type habit_schedule_type not null,
  schedule_config jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.habit_day_instances (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.habits(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  date_local date not null,
  status habit_instance_status not null default 'pending',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (habit_id, date_local)
);

create index if not exists idx_habit_day_instances_user_date
  on public.habit_day_instances(user_id, date_local);

create table if not exists public.daily_summaries (
  user_id uuid not null references public.profiles(id) on delete cascade,
  date_local date not null,
  scheduled_count integer not null default 0,
  completed_count integer not null default 0,
  completion_rate numeric(5,4) not null default 0,
  streak_count integer not null default 0,
  token_used boolean not null default false,
  xp_awarded integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, date_local)
);

create table if not exists public.badges (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  criteria text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.user_badges (
  user_id uuid not null references public.profiles(id) on delete cascade,
  badge_id uuid not null references public.badges(id) on delete cascade,
  awarded_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

create table if not exists public.reward_contracts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  rule_type reward_rule_type not null default 'completion_threshold',
  rule_config jsonb not null default '{"threshold":1}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reward_unlocks (
  id uuid primary key default gen_random_uuid(),
  reward_contract_id uuid not null references public.reward_contracts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  date_local date not null,
  status reward_unlock_status not null default 'locked',
  redeemed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (reward_contract_id, date_local)
);

create index if not exists idx_reward_unlocks_user_date
  on public.reward_unlocks(user_id, date_local desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

create trigger set_habits_updated_at
before update on public.habits
for each row execute procedure public.set_updated_at();

create trigger set_habit_day_instances_updated_at
before update on public.habit_day_instances
for each row execute procedure public.set_updated_at();

create trigger set_daily_summaries_updated_at
before update on public.daily_summaries
for each row execute procedure public.set_updated_at();

create trigger set_reward_contracts_updated_at
before update on public.reward_contracts
for each row execute procedure public.set_updated_at();

create trigger set_reward_unlocks_updated_at
before update on public.reward_unlocks
for each row execute procedure public.set_updated_at();

create or replace function public.on_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.on_auth_user_created();

create or replace function public.assert_user_match(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is distinct from p_user and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'not authorized';
  end if;
end;
$$;

create or replace function public.is_habit_scheduled(
  p_schedule_type habit_schedule_type,
  p_schedule_config jsonb,
  p_date date
)
returns boolean
language plpgsql
immutable
as $$
declare
  v_dow integer := extract(dow from p_date);
  v_times integer;
  v_preferred integer[];
begin
  if p_schedule_type = 'daily' then
    return true;
  end if;

  if p_schedule_type = 'weekdays' then
    return v_dow between 1 and 5;
  end if;

  if p_schedule_type = 'custom_days' then
    return exists (
      select 1
      from jsonb_array_elements_text(coalesce(p_schedule_config -> 'daysOfWeek', '[]'::jsonb)) as day_value
      where (day_value)::integer = v_dow
    );
  end if;

  v_times := greatest(1, least(7, coalesce((p_schedule_config ->> 'timesPerWeek')::integer, 1)));

  if jsonb_typeof(p_schedule_config -> 'preferredDays') = 'array' then
    select coalesce(array_agg(distinct ((value)::integer % 7 + 7) % 7), array[]::integer[])
    into v_preferred
    from jsonb_array_elements_text(p_schedule_config -> 'preferredDays');
  else
    v_preferred := array[1,2,3,4,5,6,0];
  end if;

  if coalesce(array_length(v_preferred, 1), 0) = 0 then
    v_preferred := array[1,2,3,4,5,6,0];
  end if;

  return v_dow = any(v_preferred[1:v_times]);
end;
$$;

create or replace function public.get_effective_local_date(
  p_timezone text,
  p_day_cutoff_minutes integer,
  p_now timestamptz default now()
)
returns date
language plpgsql
stable
as $$
declare
  v_local timestamp;
  v_minutes integer;
begin
  v_local := timezone(p_timezone, p_now);
  v_minutes := extract(hour from v_local)::integer * 60 + extract(minute from v_local)::integer;

  if v_minutes < greatest(0, least(1439, p_day_cutoff_minutes)) then
    v_local := v_local - interval '1 day';
  end if;

  return v_local::date;
end;
$$;

create or replace function public.recompute_daily_summary(p_user uuid, p_date date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_scheduled integer := 0;
  v_completed integer := 0;
  v_completion_rate numeric(5,4) := 0;
  v_previous_streak integer := 0;
  v_threshold numeric(4,3) := 0.8;
  v_current_tokens integer := 0;
  v_existing_xp integer := 0;
  v_existing_token_used boolean := false;
  v_next_streak integer := 0;
  v_token_used boolean := false;
  v_tokens_remaining integer := 0;
  v_xp_awarded integer := 0;
  v_xp_delta integer := 0;
  v_profile_xp integer := 0;
  v_profile_level integer := 1;
begin
  perform public.assert_user_match(p_user);

  select
    count(*)::integer,
    count(*) filter (where status = 'done')::integer
  into v_scheduled, v_completed
  from public.habit_day_instances
  where user_id = p_user
    and date_local = p_date;

  if v_scheduled > 0 then
    v_completion_rate := round((v_completed::numeric / v_scheduled::numeric)::numeric, 4);
  end if;

  select streak_count
  into v_previous_streak
  from public.daily_summaries
  where user_id = p_user
    and date_local = p_date - 1;

  v_previous_streak := coalesce(v_previous_streak, 0);

  select streak_threshold, streak_protection_tokens, xp
  into v_threshold, v_current_tokens, v_profile_xp
  from public.profiles
  where id = p_user
  for update;

  select coalesce(xp_awarded, 0), coalesce(token_used, false)
  into v_existing_xp, v_existing_token_used
  from public.daily_summaries
  where user_id = p_user
    and date_local = p_date;

  v_tokens_remaining := v_current_tokens + case when v_existing_token_used then 1 else 0 end;

  if v_scheduled = 0 then
    v_next_streak := v_previous_streak;
    v_token_used := false;
  elsif v_completion_rate >= v_threshold then
    v_next_streak := v_previous_streak + 1;
    v_token_used := false;
  elsif v_tokens_remaining > 0 then
    v_next_streak := v_previous_streak;
    v_token_used := true;
    v_tokens_remaining := v_tokens_remaining - 1;
  else
    v_next_streak := 0;
    v_token_used := false;
  end if;

  v_xp_awarded := case when v_scheduled > 0 then v_completed * 10 else 0 end
    + case when v_scheduled > 0 and v_completion_rate >= 1 then 15 else 0 end
    + case when v_next_streak > 0 and mod(v_next_streak, 7) = 0 then 20 else 0 end;

  insert into public.daily_summaries (
    user_id,
    date_local,
    scheduled_count,
    completed_count,
    completion_rate,
    streak_count,
    token_used,
    xp_awarded
  )
  values (
    p_user,
    p_date,
    v_scheduled,
    v_completed,
    v_completion_rate,
    v_next_streak,
    v_token_used,
    v_xp_awarded
  )
  on conflict (user_id, date_local)
  do update set
    scheduled_count = excluded.scheduled_count,
    completed_count = excluded.completed_count,
    completion_rate = excluded.completion_rate,
    streak_count = excluded.streak_count,
    token_used = excluded.token_used,
    xp_awarded = excluded.xp_awarded,
    updated_at = now();

  v_xp_delta := v_xp_awarded - v_existing_xp;

  update public.profiles
  set
    streak_count = v_next_streak,
    streak_protection_tokens = greatest(0, v_tokens_remaining),
    xp = greatest(0, xp + v_xp_delta),
    level = greatest(1, floor((greatest(0, xp + v_xp_delta)) / 500) + 1)
  where id = p_user
  returning xp, level into v_profile_xp, v_profile_level;
end;
$$;

create or replace function public.refresh_reward_unlocks(p_user uuid, p_date date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_completion_rate numeric(5,4) := 0;
begin
  perform public.assert_user_match(p_user);

  select completion_rate
  into v_completion_rate
  from public.daily_summaries
  where user_id = p_user
    and date_local = p_date;

  v_completion_rate := coalesce(v_completion_rate, 0);

  insert into public.reward_unlocks (
    reward_contract_id,
    user_id,
    date_local,
    status
  )
  select
    rc.id,
    rc.user_id,
    p_date,
    case
      when v_completion_rate >= coalesce((rc.rule_config ->> 'threshold')::numeric, 1) then 'unlocked'::reward_unlock_status
      else 'locked'::reward_unlock_status
    end
  from public.reward_contracts rc
  where rc.user_id = p_user
    and rc.is_active = true
  on conflict (reward_contract_id, date_local)
  do update
  set
    status = case
      when public.reward_unlocks.status = 'redeemed' then 'redeemed'::reward_unlock_status
      else excluded.status
    end,
    updated_at = now();
end;
$$;

create or replace function public.award_badges_for_day(p_user uuid, p_date date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_streak integer := 0;
  v_weekly_consistency numeric(5,4) := 0;
begin
  perform public.assert_user_match(p_user);

  select streak_count
  into v_streak
  from public.daily_summaries
  where user_id = p_user
    and date_local = p_date;

  v_streak := coalesce(v_streak, 0);

  if v_streak >= 3 then
    insert into public.user_badges (user_id, badge_id)
    select p_user, id
    from public.badges
    where code = 'streak_3'
    on conflict do nothing;
  end if;

  if v_streak >= 7 then
    insert into public.user_badges (user_id, badge_id)
    select p_user, id
    from public.badges
    where code = 'streak_7'
    on conflict do nothing;
  end if;

  if v_streak >= 30 then
    insert into public.user_badges (user_id, badge_id)
    select p_user, id
    from public.badges
    where code = 'streak_30'
    on conflict do nothing;
  end if;

  select coalesce(avg(completion_rate), 0)
  into v_weekly_consistency
  from public.daily_summaries
  where user_id = p_user
    and date_local between p_date - 6 and p_date
    and scheduled_count > 0;

  if v_weekly_consistency >= 0.9 then
    insert into public.user_badges (user_id, badge_id)
    select p_user, id
    from public.badges
    where code = 'consistency_90_week'
    on conflict do nothing;
  end if;
end;
$$;

create or replace function public.generate_day_instances_for_user(
  p_user uuid,
  p_date date default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_date date;
  v_timezone text;
  v_cutoff integer;
  v_missed_date date;
begin
  perform public.assert_user_match(p_user);

  select timezone, day_cutoff_minutes
  into v_timezone, v_cutoff
  from public.profiles
  where id = p_user;

  if v_timezone is null then
    raise exception 'profile not found';
  end if;

  v_target_date := coalesce(p_date, public.get_effective_local_date(v_timezone, v_cutoff, now()));

  for v_missed_date in
    select distinct date_local
    from public.habit_day_instances
    where user_id = p_user
      and status = 'pending'
      and date_local < v_target_date
  loop
    update public.habit_day_instances
    set status = 'missed'
    where user_id = p_user
      and date_local = v_missed_date
      and status = 'pending';

    perform public.recompute_daily_summary(p_user, v_missed_date);
    perform public.refresh_reward_unlocks(p_user, v_missed_date);
    perform public.award_badges_for_day(p_user, v_missed_date);
  end loop;

  insert into public.habit_day_instances (
    habit_id,
    user_id,
    date_local,
    status
  )
  select
    h.id,
    h.user_id,
    v_target_date,
    'pending'::habit_instance_status
  from public.habits h
  where h.user_id = p_user
    and h.is_active = true
    and public.is_habit_scheduled(h.schedule_type, h.schedule_config, v_target_date)
  on conflict (habit_id, date_local) do nothing;

  perform public.recompute_daily_summary(p_user, v_target_date);
  perform public.refresh_reward_unlocks(p_user, v_target_date);
  perform public.award_badges_for_day(p_user, v_target_date);
end;
$$;

create or replace function public.run_day_rollover()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  v_processed integer := 0;
  v_target_date date;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required';
  end if;

  for rec in
    select id, timezone, day_cutoff_minutes
    from public.profiles
  loop
    v_target_date := public.get_effective_local_date(rec.timezone, rec.day_cutoff_minutes, now());
    perform public.generate_day_instances_for_user(rec.id, v_target_date);
    v_processed := v_processed + 1;
  end loop;

  return v_processed;
end;
$$;

insert into public.badges (code, name, criteria)
values
  ('streak_3', 'Starter Streak', 'Reach a 3-day streak'),
  ('streak_7', 'Week Warrior', 'Reach a 7-day streak'),
  ('streak_30', 'Momentum Master', 'Reach a 30-day streak'),
  ('consistency_90_week', 'Consistent Week', 'Average at least 90% completion in a week')
on conflict (code) do nothing;

alter table public.profiles enable row level security;
alter table public.habits enable row level security;
alter table public.habit_day_instances enable row level security;
alter table public.daily_summaries enable row level security;
alter table public.badges enable row level security;
alter table public.user_badges enable row level security;
alter table public.reward_contracts enable row level security;
alter table public.reward_unlocks enable row level security;

create policy "profiles_select_own" on public.profiles
for select using (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
for update using (auth.uid() = id);

create policy "profiles_insert_own" on public.profiles
for insert with check (auth.uid() = id);

create policy "habits_all_own" on public.habits
for all using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "habit_day_instances_all_own" on public.habit_day_instances
for all using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "daily_summaries_select_own" on public.daily_summaries
for select using (auth.uid() = user_id);

create policy "daily_summaries_update_own" on public.daily_summaries
for update using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "daily_summaries_insert_own" on public.daily_summaries
for insert with check (auth.uid() = user_id);

create policy "badges_read_all" on public.badges
for select using (true);

create policy "user_badges_select_own" on public.user_badges
for select using (auth.uid() = user_id);

create policy "user_badges_insert_own" on public.user_badges
for insert with check (auth.uid() = user_id or coalesce(auth.role(), '') = 'service_role');

create policy "reward_contracts_all_own" on public.reward_contracts
for all using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "reward_unlocks_all_own" on public.reward_unlocks
for all using (auth.uid() = user_id)
with check (auth.uid() = user_id);

grant execute on function public.generate_day_instances_for_user(uuid, date) to authenticated, service_role;
grant execute on function public.recompute_daily_summary(uuid, date) to authenticated, service_role;
grant execute on function public.refresh_reward_unlocks(uuid, date) to authenticated, service_role;
grant execute on function public.award_badges_for_day(uuid, date) to authenticated, service_role;
grant execute on function public.run_day_rollover() to service_role;

grant execute on function public.get_effective_local_date(text, integer, timestamptz) to authenticated, service_role;

grant execute on function public.is_habit_scheduled(habit_schedule_type, jsonb, date) to authenticated, service_role;
