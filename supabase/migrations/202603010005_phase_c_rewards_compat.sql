begin;

-- Compatibility migration for environments that already had legacy reward_contracts schema.
alter table public.reward_contracts
  add column if not exists threshold double precision,
  add column if not exists rule_type text,
  add column if not exists is_active boolean,
  add column if not exists created_at timestamptz;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'reward_contracts'
      and column_name = 'rule_config'
  ) then
    update public.reward_contracts
    set threshold = coalesce(threshold, nullif((rule_config ->> 'threshold'), '')::double precision, 1.0)
    where threshold is null;
  end if;
end
$$;

update public.reward_contracts
set
  threshold = coalesce(threshold, 1.0),
  rule_type = coalesce(rule_type, 'completion_threshold'),
  is_active = coalesce(is_active, true),
  created_at = coalesce(created_at, now());

alter table public.reward_contracts
  alter column threshold set default 1.0,
  alter column threshold set not null,
  alter column rule_type set default 'completion_threshold',
  alter column rule_type set not null,
  alter column is_active set default true,
  alter column is_active set not null,
  alter column created_at set default now(),
  alter column created_at set not null;

alter table public.reward_contracts
  drop constraint if exists reward_contracts_threshold_check;

alter table public.reward_contracts
  add constraint reward_contracts_threshold_check
  check (threshold >= 0 and threshold <= 1);

create index if not exists idx_reward_contracts_user_created_at
  on public.reward_contracts (user_id, created_at desc);

commit;
