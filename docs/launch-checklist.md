# PatternFinder Launch Checklist

## P0 (must-pass before release)

- [ ] Apply all migrations in every environment:
  - `202603010005_phase_c_rewards_compat.sql`
  - `202603010006_phase_d_habit_logs_idempotency.sql`
  - `202603010007_phase_d_consistency_events.sql`
  - `202603010008_phase_d_decision_diagnostics_settings.sql`
- [ ] Verify environment variables are set (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, server role key if used).
- [ ] Run static checks:
  - `npm run typecheck`
  - `npm run test`
- [ ] Run manual smoke flows:
  - `/today`: toggle habits, verify streak explanation and recent decisions update.
  - `/rewards`: create/edit/pause/delete contracts; confirm optimistic updates + rollback on failure.
  - `/today`: redeem unlocked reward; verify history and weekly redeemed stat.
  - `/reports`: daily + weekly summary visible.
  - `/reports/decisions`: save diagnostics settings, refresh, confirm persistence.
- [ ] Confirm RLS ownership for every touched table using a non-owner test user.

## P1 (strongly recommended)

- [ ] Add basic uptime/error monitoring for API routes.
- [x] Add one e2e test for reward flow (`create contract -> unlock -> redeem`).
- [x] Add one e2e test for diagnostics settings persistence.
- [ ] Document rollback plan for each migration.

## Release command sequence

```bash
npx supabase@latest db push
npm run typecheck
npm run test
npm run dev
```
