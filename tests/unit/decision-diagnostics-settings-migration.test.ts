import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const migrationPath = path.resolve(
  __dirname,
  "../../supabase/migrations/202603010008_phase_d_decision_diagnostics_settings.sql"
);

describe("decision diagnostics settings migration", () => {
  it("creates per-user settings table with bounded diagnostics controls", () => {
    const sql = fs.readFileSync(migrationPath, "utf8");

    expect(sql).toMatch(/create table if not exists public\.decision_diagnostics_settings/i);
    expect(sql).toMatch(/user_id uuid primary key references auth\.users\(id\)/i);
    expect(sql).toMatch(/token_window_days integer not null default 7/i);
    expect(sql).toMatch(/token_usage_threshold integer not null default 2/i);
    expect(sql).toMatch(/reward_window_days integer not null default 14/i);
    expect(sql).toMatch(/streak_eval_window_days integer not null default 2/i);
  });

  it("enables rls with ownership policies", () => {
    const sql = fs.readFileSync(migrationPath, "utf8");

    expect(sql).toMatch(/alter table public\.decision_diagnostics_settings enable row level security/i);
    expect(sql).toMatch(/create policy decision_diagnostics_settings_select_own/i);
    expect(sql).toMatch(/create policy decision_diagnostics_settings_insert_own/i);
    expect(sql).toMatch(/create policy decision_diagnostics_settings_update_own/i);
    expect(sql).toMatch(/using\s*\(\s*auth\.uid\(\)\s*=\s*user_id\s*\)/i);
    expect(sql).toMatch(/with check\s*\(\s*auth\.uid\(\)\s*=\s*user_id\s*\)/i);
  });
});
