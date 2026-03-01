import { describe, expect, it } from "vitest";
import { defaultRewardRuleConfig, evaluateRewardUnlock } from "../src/rewards";

describe("rewards", () => {
  it("uses default 100% threshold", () => {
    expect(defaultRewardRuleConfig()).toEqual({ threshold: 1 });
  });

  it("unlocks when threshold is reached", () => {
    const unlocked = evaluateRewardUnlock({ completionRate: 0.9 }, { threshold: 0.8 });
    const locked = evaluateRewardUnlock({ completionRate: 0.79 }, { threshold: 0.8 });

    expect(unlocked).toBe(true);
    expect(locked).toBe(false);
  });
});
