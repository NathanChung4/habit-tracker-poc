import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const migrationPath = path.resolve(
  __dirname,
  "../../supabase/migrations/202603010007_phase_d_consistency_events.sql"
);

describe("consistency events migration", () => {
  it("creates append-only consistency_events table with dedupe key", () => {
    const sql = fs.readFileSync(migrationPath, "utf8");

    expect(sql).toMatch(/create table if not exists public\.consistency_events/i);
    expect(sql).toMatch(/event_type text not null check/i);
    expect(sql).toMatch(/event_key text not null/i);
    expect(sql).toMatch(/unique\s*\(\s*user_id\s*,\s*event_key\s*\)/i);
  });

  it("enables rls and ownership policies for select and insert", () => {
    const sql = fs.readFileSync(migrationPath, "utf8");

    expect(sql).toMatch(/alter table public\.consistency_events enable row level security/i);
    expect(sql).toMatch(/create policy consistency_events_select_own/i);
    expect(sql).toMatch(/create policy consistency_events_insert_own/i);
    expect(sql).toMatch(/using\s*\(\s*auth\.uid\(\)\s*=\s*user_id\s*\)/i);
    expect(sql).toMatch(/with check\s*\(\s*auth\.uid\(\)\s*=\s*user_id\s*\)/i);
  });
});
