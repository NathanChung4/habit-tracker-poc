# PatternFinder Habit Consistency POC

Web-first habit tracker MVP built with Next.js + Supabase. The project is structured to share domain logic with a future React Native Expo iOS app.

## Features implemented

- Email/password auth with Supabase
- Habit CRUD with flexible schedules:
  - `daily`
  - `weekdays`
  - `custom_days`
  - `times_per_week`
- Daily checklist with optimistic toggle updates
- User timezone + cutoff-aware daily date resolution
- Daily summaries (completion %, streak, token usage, XP/level)
- Streak protection tokens
- Reward contracts and unlock/redeem flow (honor system)
- Daily and weekly report APIs + report UI
- Badge awarding engine
- Supabase row-level security policies
- Hourly day-rollover RPC entrypoint for edge cron

## Routes

- `/login`
- `/today`
- `/habits`
- `/reports`
- `/rewards`
- `/settings`

## API

- `GET/POST /api/habits`
- `PATCH/DELETE /api/habits/:id`
- `POST /api/day-instances/:id/toggle`
- `GET /api/reports/daily?start&end`
- `GET /api/reports/weekly?weeks=n`
- `GET/POST /api/rewards/contracts`
- `PATCH /api/rewards/contracts/:id`
- `POST /api/rewards/:unlockId/redeem`
- `GET/PATCH /api/settings`

## Setup

1. Install dependencies:

```bash
npm install
```

2. Configure env:

```bash
cp .env.example .env.local
```

3. Fill in Supabase values in `.env.local`.

4. Apply migration:

```bash
supabase db push
```

5. Run app:

```bash
npm run dev
```

## Supabase edge functions

Included functions:

- `supabase/functions/day-rollover`
- `supabase/functions/on-user-created`

Deploy example:

```bash
supabase functions deploy day-rollover
supabase functions deploy on-user-created
```

Schedule `day-rollover` hourly using Supabase scheduled functions or an external cron.

## Testing

```bash
npm run test
npm run test:e2e
```

Current tests include domain unit tests, integration flow tests, and Playwright scaffolding.

## Shared domain package

`packages/domain` contains portable scheduling/streak/reward/time logic for reuse by a future React Native Expo client.
