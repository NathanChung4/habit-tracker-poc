import { describe, expect, it } from "vitest";
import { applyStreakAndTokenPolicy, getEffectiveDateForProfile } from "../../lib/data";

describe("applyStreakAndTokenPolicy", () => {
  it("increments streak when completion meets the 80% threshold", () => {
    const rows = applyStreakAndTokenPolicy(
      [
        { date_local: "2026-03-01", scheduled_count: 5, completed_count: 4 },
        { date_local: "2026-03-02", scheduled_count: 5, completed_count: 5 },
        { date_local: "2026-03-03", scheduled_count: 5, completed_count: 3 }
      ],
      { protectionTokens: 2, todayLocal: "2026-03-03" }
    );

    expect(rows.map((row) => row.streak_count)).toEqual([1, 2, 2]);
    expect(rows.map((row) => row.token_used)).toEqual([false, false, false]);
  });

  it("uses one protection token on a missed non-today day", () => {
    const rows = applyStreakAndTokenPolicy(
      [
        { date_local: "2026-03-01", scheduled_count: 4, completed_count: 4 },
        { date_local: "2026-03-02", scheduled_count: 4, completed_count: 1 },
        { date_local: "2026-03-03", scheduled_count: 4, completed_count: 4 }
      ],
      { protectionTokens: 1, todayLocal: "2026-03-03" }
    );

    expect(rows.map((row) => row.streak_count)).toEqual([1, 2, 3]);
    expect(rows.map((row) => row.token_used)).toEqual([false, true, false]);
  });

  it("resets streak after tokens are exhausted", () => {
    const rows = applyStreakAndTokenPolicy(
      [
        { date_local: "2026-03-01", scheduled_count: 4, completed_count: 4 },
        { date_local: "2026-03-02", scheduled_count: 4, completed_count: 0 },
        { date_local: "2026-03-03", scheduled_count: 4, completed_count: 0 }
      ],
      { protectionTokens: 1, todayLocal: "2026-03-04" }
    );

    expect(rows.map((row) => row.streak_count)).toEqual([1, 2, 0]);
    expect(rows.map((row) => row.token_used)).toEqual([false, true, false]);
  });

  it("keeps streak unchanged for days with zero scheduled habits", () => {
    const rows = applyStreakAndTokenPolicy(
      [
        { date_local: "2026-03-01", scheduled_count: 3, completed_count: 3 },
        { date_local: "2026-03-02", scheduled_count: 0, completed_count: 0 },
        { date_local: "2026-03-03", scheduled_count: 3, completed_count: 3 }
      ],
      { protectionTokens: 1, todayLocal: "2026-03-03" }
    );

    expect(rows.map((row) => row.streak_count)).toEqual([1, 1, 2]);
    expect(rows[1].completion_rate).toBe(0);
  });
});

describe("getEffectiveDateForProfile", () => {
  it("rolls back to the previous day before cutoff in UTC", () => {
    const profile = { timezone: "UTC", cutoff_time: "04:00:00" };
    const beforeCutoff = new Date("2026-03-01T03:59:59.000Z");
    const atCutoff = new Date("2026-03-01T04:00:00.000Z");

    expect(getEffectiveDateForProfile(beforeCutoff, profile)).toBe("2026-02-28");
    expect(getEffectiveDateForProfile(atCutoff, profile)).toBe("2026-03-01");
  });

  it("uses IANA timezone conversion with cutoff boundaries", () => {
    const profile = { timezone: "America/Chicago", cutoff_time: "04:00:00" };
    const beforeCutoff = new Date("2026-03-01T09:59:00.000Z");
    const atCutoff = new Date("2026-03-01T10:00:00.000Z");

    expect(getEffectiveDateForProfile(beforeCutoff, profile)).toBe("2026-02-28");
    expect(getEffectiveDateForProfile(atCutoff, profile)).toBe("2026-03-01");
  });
});
