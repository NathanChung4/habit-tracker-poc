begin;

create extension if not exists "uuid-ossp" with schema extensions;

create table if not exists public.consistency_events (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date_local date not null,
  event_type text not null check (event_type in ('streak_evaluated', 'token_consumed', 'reward_unlocked', 'reward_redeemed')),
  event_key text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, event_key)
);

create index if not exists idx_consistency_events_user_created_at
  on public.consistency_events (user_id, created_at desc);

alter table public.consistency_events enable row level security;

drop policy if exists consistency_events_select_own on public.consistency_events;
drop policy if exists consistency_events_insert_own on public.consistency_events;

create policy consistency_events_select_own
on public.consistency_events
for select
using (auth.uid() = user_id);

create policy consistency_events_insert_own
on public.consistency_events
for insert
with check (auth.uid() = user_id);

commit;
