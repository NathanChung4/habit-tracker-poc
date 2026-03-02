import { describe, expect, it } from "vitest";
import { reportDailyQuerySchema, reportWeeklyQuerySchema } from "../../lib/validators";

describe("reports query validators", () => {
  it("accepts valid daily range", () => {
    const result = reportDailyQuerySchema.parse({ start: "2026-02-20", end: "2026-03-01" });
    expect(result).toEqual({ start: "2026-02-20", end: "2026-03-01" });
  });

  it("rejects invalid daily range", () => {
    const result = reportDailyQuerySchema.safeParse({ start: "2026-03-10", end: "2026-03-01" });
    expect(result.success).toBe(false);
  });

  it("defaults weekly weeks to 8", () => {
    const result = reportWeeklyQuerySchema.parse({});
    expect(result).toEqual({ weeks: 8 });
  });

  it("rejects out-of-range weeks", () => {
    const low = reportWeeklyQuerySchema.safeParse({ weeks: 0 });
    const high = reportWeeklyQuerySchema.safeParse({ weeks: 53 });
    expect(low.success).toBe(false);
    expect(high.success).toBe(false);
  });
});
