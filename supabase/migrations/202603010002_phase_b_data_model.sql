begin;

create extension if not exists "uuid-ossp" with schema extensions;

-- profiles table (create-or-align to AGENTS.md model)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade
);

alter table public.profiles
  add column if not exists timezone text,
  add column if not exists cutoff_time time,
  add column if not exists protection_tokens integer;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'streak_protection_tokens'
  ) then
    update public.profiles
    set protection_tokens = coalesce(protection_tokens, streak_protection_tokens)
    where protection_tokens is null;
  end if;
end
$$;

update public.profiles
set
  timezone = coalesce(timezone, 'UTC'),
  cutoff_time = coalesce(cutoff_time, '04:00'::time),
  protection_tokens = coalesce(protection_tokens, 3);

alter table public.profiles
  alter column timezone set default 'UTC',
  alter column timezone set not null,
  alter column cutoff_time set default '04:00'::time,
  alter column cutoff_time set not null,
  alter column protection_tokens set default 3,
  alter column protection_tokens set not null;

alter table public.profiles
  drop constraint if exists profiles_protection_tokens_check;

alter table public.profiles
  add constraint profiles_protection_tokens_check
  check (protection_tokens >= 0);

-- habits table (create-or-align to AGENTS.md model)
create table if not exists public.habits (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  frequency_type text not null default 'daily',
  target_threshold double precision not null default 0.8,
  created_at timestamptz not null default now()
);

alter table public.habits
  add column if not exists name text,
  add column if not exists description text,
  add column if not exists frequency_type text,
  add column if not exists target_threshold double precision,
  add column if not exists created_at timestamptz;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'habits'
      and column_name = 'title'
  ) then
    update public.habits
    set name = coalesce(name, title)
    where name is null;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'habits'
      and column_name = 'notes'
  ) then
    update public.habits
    set description = coalesce(description, notes)
    where description is null;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'habits'
      and column_name = 'schedule_type'
  ) then
    update public.habits
    set frequency_type = coalesce(frequency_type, schedule_type::text)
    where frequency_type is null;
  end if;
end
$$;

update public.habits
set
  name = coalesce(name, 'Untitled Habit'),
  frequency_type = coalesce(frequency_type, 'daily'),
  target_threshold = coalesce(target_threshold, 0.8),
  created_at = coalesce(created_at, now());

alter table public.habits
  alter column name set not null,
  alter column frequency_type set default 'daily',
  alter column frequency_type set not null,
  alter column target_threshold set default 0.8,
  alter column target_threshold set not null,
  alter column created_at set default now(),
  alter column created_at set not null;

alter table public.habits
  drop constraint if exists habits_target_threshold_check;

alter table public.habits
  add constraint habits_target_threshold_check
  check (target_threshold >= 0 and target_threshold <= 1);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.habits'::regclass
      and conname = 'habits_user_id_auth_users_fkey'
  ) then
    alter table public.habits
      add constraint habits_user_id_auth_users_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
end
$$;

-- habit_logs table (strictly per AGENTS.md)
create table if not exists public.habit_logs (
  id uuid primary key default extensions.uuid_generate_v4(),
  habit_id uuid not null references public.habits(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  completed_at date not null,
  value double precision not null default 1.0,
  metadata jsonb
);

create index if not exists idx_habits_user_id on public.habits(user_id);
create index if not exists idx_habit_logs_user_id_completed_at on public.habit_logs(user_id, completed_at desc);
create index if not exists idx_habit_logs_habit_id_completed_at on public.habit_logs(habit_id, completed_at desc);

-- RLS (required by AGENTS.md)
alter table public.profiles enable row level security;
alter table public.habits enable row level security;
alter table public.habit_logs enable row level security;

drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
drop policy if exists profiles_delete_own on public.profiles;

create policy profiles_select_own
on public.profiles
for select
using (auth.uid() = id);

create policy profiles_insert_own
on public.profiles
for insert
with check (auth.uid() = id);

create policy profiles_update_own
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

create policy profiles_delete_own
on public.profiles
for delete
using (auth.uid() = id);

drop policy if exists habits_select_own on public.habits;
drop policy if exists habits_insert_own on public.habits;
drop policy if exists habits_update_own on public.habits;
drop policy if exists habits_delete_own on public.habits;

create policy habits_select_own
on public.habits
for select
using (auth.uid() = user_id);

create policy habits_insert_own
on public.habits
for insert
with check (auth.uid() = user_id);

create policy habits_update_own
on public.habits
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy habits_delete_own
on public.habits
for delete
using (auth.uid() = user_id);

drop policy if exists habit_logs_select_own on public.habit_logs;
drop policy if exists habit_logs_insert_own on public.habit_logs;
drop policy if exists habit_logs_update_own on public.habit_logs;
drop policy if exists habit_logs_delete_own on public.habit_logs;

create policy habit_logs_select_own
on public.habit_logs
for select
using (
  auth.uid() = user_id
  and exists (
    select 1
    from public.habits h
    where h.id = habit_logs.habit_id
      and h.user_id = auth.uid()
  )
);

create policy habit_logs_insert_own
on public.habit_logs
for insert
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.habits h
    where h.id = habit_logs.habit_id
      and h.user_id = auth.uid()
  )
);

create policy habit_logs_update_own
on public.habit_logs
for update
using (
  auth.uid() = user_id
  and exists (
    select 1
    from public.habits h
    where h.id = habit_logs.habit_id
      and h.user_id = auth.uid()
  )
)
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.habits h
    where h.id = habit_logs.habit_id
      and h.user_id = auth.uid()
  )
);

create policy habit_logs_delete_own
on public.habit_logs
for delete
using (
  auth.uid() = user_id
  and exists (
    select 1
    from public.habits h
    where h.id = habit_logs.habit_id
      and h.user_id = auth.uid()
  )
);

commit;
