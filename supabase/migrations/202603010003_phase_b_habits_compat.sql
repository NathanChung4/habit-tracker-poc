begin;

-- Phase B compatibility fix:
-- Earlier scaffolding kept legacy non-null columns on habits (title/schedule_type).
-- This migration ensures inserts using the Phase B model succeed.

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
    set title = coalesce(title, name)
    where title is null;

    alter table public.habits
      alter column title drop not null;
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'habits'
      and column_name = 'schedule_type'
  ) then
    alter table public.habits
      alter column schedule_type set default 'daily'::habit_schedule_type;
  end if;
end
$$;

commit;
