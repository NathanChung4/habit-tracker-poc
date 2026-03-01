import { describe, expect, it } from "vitest";
import {
  decisionDiagnosticsSettingsPatchSchema,
  decisionDiagnosticsSettingsSchema
} from "../../lib/validators";

describe("decision diagnostics settings validators", () => {
  it("accepts a valid settings payload", () => {
    const result = decisionDiagnosticsSettingsSchema.parse({
      tokenWindowDays: 10,
      tokenUsageThreshold: 3,
      rewardWindowDays: 21,
      streakEvalWindowDays: 4
    });

    expect(result).toEqual({
      tokenWindowDays: 10,
      tokenUsageThreshold: 3,
      rewardWindowDays: 21,
      streakEvalWindowDays: 4
    });
  });

  it("rejects out-of-range values", () => {
    const result = decisionDiagnosticsSettingsSchema.safeParse({
      tokenWindowDays: 0,
      tokenUsageThreshold: 30,
      rewardWindowDays: 61,
      streakEvalWindowDays: -1
    });

    expect(result.success).toBe(false);
  });

  it("requires at least one field on patch", () => {
    const result = decisionDiagnosticsSettingsPatchSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("accepts partial patch payload", () => {
    const result = decisionDiagnosticsSettingsPatchSchema.parse({
      rewardWindowDays: 28
    });

    expect(result).toEqual({ rewardWindowDays: 28 });
  });
});
