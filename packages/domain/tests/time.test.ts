import { describe, expect, it } from "vitest";
import { getEffectiveLocalDate, getWeekStartDate, shiftDateLocal } from "../src/time";

describe("time", () => {
  it("shifts effective date before cutoff", () => {
    const now = new Date("2026-03-02T05:30:00Z"); // 23:30 previous day in America/Chicago
    const dateLocal = getEffectiveLocalDate(now, "America/Chicago", 60); // cutoff 1:00 AM
    expect(dateLocal).toBe("2026-03-01");
  });

  it("keeps date after cutoff", () => {
    const now = new Date("2026-03-02T09:30:00Z"); // 03:30 in America/Chicago
    const dateLocal = getEffectiveLocalDate(now, "America/Chicago", 60);
    expect(dateLocal).toBe("2026-03-02");
  });

  it("returns monday as week start", () => {
    expect(getWeekStartDate("2026-03-01")).toBe("2026-02-23"); // sunday
    expect(getWeekStartDate("2026-03-04")).toBe("2026-03-02"); // wednesday
  });

  it("shifts local date", () => {
    expect(shiftDateLocal("2026-03-01", 2)).toBe("2026-03-03");
  });
});
