import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const migrationPath = path.resolve(
  __dirname,
  "../../supabase/migrations/202603010006_phase_d_habit_logs_idempotency.sql"
);

describe("habit log idempotency migration", () => {
  it("defines a unique index for user/habit/day rows", () => {
    const sql = fs.readFileSync(migrationPath, "utf8");

    expect(sql).toMatch(/create unique index if not exists idx_habit_logs_user_habit_date_unique/i);
    expect(sql).toMatch(/\(\s*user_id\s*,\s*habit_id\s*,\s*completed_at\s*\)/i);
  });

  it("deduplicates existing habit logs before applying uniqueness", () => {
    const sql = fs.readFileSync(migrationPath, "utf8");

    expect(sql).toMatch(/row_number\(\)\s+over\s*\(/i);
    expect(sql).toMatch(/partition by user_id,\s*habit_id,\s*completed_at/i);
    expect(sql).toMatch(/delete from public\.habit_logs/i);
  });
});
