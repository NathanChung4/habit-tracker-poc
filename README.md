# PatternFinder Habit Consistency POC

Web-first habit tracker built with Next.js + Supabase. The codebase is currently aligned to the Phase B `agents.md` source of truth.

## Phase B scope (current)

- Email/password auth with Supabase
- Core schema alignment to:
  - `profiles`
  - `habits`
  - `habit_logs`
- Habit CRUD using Phase B fields:
  - `name`, `description`, `frequency_type`, `target_threshold`
- Today checklist using binary completion logs (`habit_logs.value = 1.0`)
- Timezone + `cutoff_time` based effective day logic
- 80% streak rule with protection-token aware streak computation
- Daily and weekly consistency reports computed from habits + logs
- RLS-enabled tables and ownership-safe queries

## Not active in Phase B

- Rewards/contracts APIs and UI are intentionally disabled (Phase C)
- XP/levels/badges pipeline from earlier scaffolding is not used in this phase

## Routes

- `/login`
- `/today`
- `/habits`
- `/reports`
- `/rewards` (placeholder for Phase C)
- `/settings`

## API

- `GET/POST /api/habits`
- `PATCH/DELETE /api/habits/:id`
- `POST /api/day-instances/:id/toggle` (toggles today log for habit id)
- `GET /api/reports/daily?start&end`
- `GET /api/reports/weekly?weeks=n`
- `GET/PATCH /api/settings`

Rewards endpoints currently return `410` in Phase B.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Configure env:

```bash
cp .env.example .env.local
```

3. Fill Supabase values in `.env.local`.

4. Apply migrations:

```bash
npx supabase@latest db push
```

5. Run app:

```bash
npm run dev
```

## Testing

```bash
npm run typecheck
npm run test
```

## Shared domain package

`packages/domain` contains portable schedule/time/streak utilities for future web/mobile reuse.
