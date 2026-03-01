begin;

create extension if not exists "uuid-ossp" with schema extensions;

create table if not exists public.reward_contracts (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  rule_type text not null default 'completion_threshold',
  threshold double precision not null default 1.0 check (threshold >= 0 and threshold <= 1),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.reward_unlocks (
  id uuid primary key default extensions.uuid_generate_v4(),
  reward_contract_id uuid not null references public.reward_contracts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  date_local date not null,
  status text not null default 'locked' check (status in ('locked', 'unlocked', 'redeemed')),
  redeemed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (reward_contract_id, date_local)
);

create index if not exists idx_reward_contracts_user_created_at
  on public.reward_contracts (user_id, created_at desc);

create index if not exists idx_reward_unlocks_user_date
  on public.reward_unlocks (user_id, date_local desc);

alter table public.reward_contracts enable row level security;
alter table public.reward_unlocks enable row level security;

drop policy if exists reward_contracts_select_own on public.reward_contracts;
drop policy if exists reward_contracts_insert_own on public.reward_contracts;
drop policy if exists reward_contracts_update_own on public.reward_contracts;
drop policy if exists reward_contracts_delete_own on public.reward_contracts;

create policy reward_contracts_select_own
on public.reward_contracts
for select
using (auth.uid() = user_id);

create policy reward_contracts_insert_own
on public.reward_contracts
for insert
with check (auth.uid() = user_id);

create policy reward_contracts_update_own
on public.reward_contracts
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy reward_contracts_delete_own
on public.reward_contracts
for delete
using (auth.uid() = user_id);

drop policy if exists reward_unlocks_select_own on public.reward_unlocks;
drop policy if exists reward_unlocks_insert_own on public.reward_unlocks;
drop policy if exists reward_unlocks_update_own on public.reward_unlocks;
drop policy if exists reward_unlocks_delete_own on public.reward_unlocks;

create policy reward_unlocks_select_own
on public.reward_unlocks
for select
using (
  auth.uid() = user_id
  and exists (
    select 1
    from public.reward_contracts rc
    where rc.id = reward_unlocks.reward_contract_id
      and rc.user_id = auth.uid()
  )
);

create policy reward_unlocks_insert_own
on public.reward_unlocks
for insert
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.reward_contracts rc
    where rc.id = reward_unlocks.reward_contract_id
      and rc.user_id = auth.uid()
  )
);

create policy reward_unlocks_update_own
on public.reward_unlocks
for update
using (
  auth.uid() = user_id
  and exists (
    select 1
    from public.reward_contracts rc
    where rc.id = reward_unlocks.reward_contract_id
      and rc.user_id = auth.uid()
  )
)
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.reward_contracts rc
    where rc.id = reward_unlocks.reward_contract_id
      and rc.user_id = auth.uid()
  )
);

create policy reward_unlocks_delete_own
on public.reward_unlocks
for delete
using (
  auth.uid() = user_id
  and exists (
    select 1
    from public.reward_contracts rc
    where rc.id = reward_unlocks.reward_contract_id
      and rc.user_id = auth.uid()
  )
);

commit;
