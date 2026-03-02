# PatternFinder Habit Consistency POC

Web-first habit tracker built with Next.js + Supabase. The codebase is aligned to the `agents.md` source of truth, including Phase C rewards.

## Current scope

- Email/password auth with Supabase
- Core schema alignment to:
  - `profiles`
  - `habits`
  - `habit_logs`
- Habit CRUD using schema fields:
  - `name`, `description`, `frequency_type`, `target_threshold`
- Today checklist using binary completion logs (`habit_logs.value = 1.0`)
- Timezone + `cutoff_time` based effective day logic
- 80% streak rule with protection-token aware streak computation
- Daily and weekly consistency reports computed from habits + logs
- Strict query validation on reports APIs (`start/end` date ranges, `weeks` bounds)
- Reward contracts (`reward_contracts`) create/list/update/delete
- Reward unlock engine on `/today` (`reward_unlocks`) based on today completion vs contract threshold
- Reward redemption flow (`unlocked -> redeemed`) on `/today`
- Recent redemption history and weekly redeemed count card
- Mutation error surfaces with retry actions on `/today` and `/rewards`
- Optimistic pause/delete updates on `/rewards` with rollback on failure
- Explainable status panel on `/today` (streak + reward status reasons)
- Consistency event audit stream (`consistency_events`) with dedupe-safe event keys
- Live-filtered recent decisions panel on `/today` (event type/date filters)
- Decision diagnostics report (`/reports/decisions`) with grouped timeline + anomaly flags
- Persistent per-user diagnostics settings for decision reports (window + threshold controls)
- RLS-enabled tables and ownership-safe queries

## Intentionally out of scope

- XP/levels/badges pipeline from earlier scaffolding is not used in this phase

## Routes

- `/login`
- `/today`
- `/habits`
- `/reports`
- `/reports/decisions`
- `/rewards`
- `/settings`

## API

- `GET/POST /api/habits`
- `PATCH/DELETE /api/habits/:id`
- `POST /api/day-instances/:id/toggle` (toggles today log for habit id)
- `GET /api/reports/daily?start&end`
- `GET /api/reports/weekly?weeks=n`
- `GET /api/events/consistency?limit&type&from&to`
- `GET/PATCH /api/reports/decision-settings`
- `GET/PATCH /api/settings`
- `GET/POST /api/rewards/contracts`
- `PATCH/DELETE /api/rewards/contracts/:id`
- `POST /api/rewards/:unlockId/redeem`

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

## Launch

Use the release checklist in `docs/launch-checklist.md` before deploying.

## Testing

```bash
npm run typecheck
npm run test
```

Authenticated e2e flows are in `tests/e2e/rewards-and-diagnostics.spec.ts` and require `E2E_EMAIL` + `E2E_PASSWORD` before running `npm run test:e2e`.

## Shared domain package

`packages/domain` contains portable schedule/time/streak utilities for future web/mobile reuse.

## Schema Compatibility

Rewards data access now assumes the migrated schema (`reward_contracts.threshold`) and no longer supports the legacy `rule_config.threshold` fallback path.

Before deploying to an environment, ensure these migrations are applied:

- `202603010005_phase_c_rewards_compat.sql`
- `202603010006_phase_d_habit_logs_idempotency.sql`
- `202603010007_phase_d_consistency_events.sql`
- `202603010008_phase_d_decision_diagnostics_settings.sql`
