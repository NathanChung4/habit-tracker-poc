begin;

-- Enforce binary-log idempotency: one row per user/habit/day.
-- Deduplicate first so uniqueness can be added safely on existing environments.
with ranked as (
  select
    ctid,
    row_number() over (
      partition by user_id, habit_id, completed_at
      order by id
    ) as rn
  from public.habit_logs
)
delete from public.habit_logs h
using ranked r
where h.ctid = r.ctid
  and r.rn > 1;

create unique index if not exists idx_habit_logs_user_habit_date_unique
  on public.habit_logs (user_id, habit_id, completed_at);

commit;
