begin;

create table if not exists public.decision_diagnostics_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token_window_days integer not null default 7 check (token_window_days between 1 and 60),
  token_usage_threshold integer not null default 2 check (token_usage_threshold between 1 and 20),
  reward_window_days integer not null default 14 check (reward_window_days between 1 and 60),
  streak_eval_window_days integer not null default 2 check (streak_eval_window_days between 1 and 30),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_decision_diagnostics_settings_updated_at
  on public.decision_diagnostics_settings (updated_at desc);

alter table public.decision_diagnostics_settings enable row level security;

drop policy if exists decision_diagnostics_settings_select_own on public.decision_diagnostics_settings;
drop policy if exists decision_diagnostics_settings_insert_own on public.decision_diagnostics_settings;
drop policy if exists decision_diagnostics_settings_update_own on public.decision_diagnostics_settings;
drop policy if exists decision_diagnostics_settings_delete_own on public.decision_diagnostics_settings;

create policy decision_diagnostics_settings_select_own
on public.decision_diagnostics_settings
for select
using (auth.uid() = user_id);

create policy decision_diagnostics_settings_insert_own
on public.decision_diagnostics_settings
for insert
with check (auth.uid() = user_id);

create policy decision_diagnostics_settings_update_own
on public.decision_diagnostics_settings
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy decision_diagnostics_settings_delete_own
on public.decision_diagnostics_settings
for delete
using (auth.uid() = user_id);

create or replace function public.set_decision_diagnostics_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_decision_diagnostics_settings_updated_at on public.decision_diagnostics_settings;

create trigger set_decision_diagnostics_settings_updated_at
before update on public.decision_diagnostics_settings
for each row
execute procedure public.set_decision_diagnostics_settings_updated_at();

commit;
