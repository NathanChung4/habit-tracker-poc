import { describe, expect, it } from "vitest";
import { computeCompletionRate, computeDailyXpAward, evaluateStreakForDay } from "../src/streak";

describe("streak", () => {
  it("increments streak when threshold is met", () => {
    const result = evaluateStreakForDay({
      previousStreak: 5,
      completionRate: 0.9,
      threshold: 0.8,
      protectionTokens: 1,
      scheduledCount: 4
    });

    expect(result.nextStreak).toBe(6);
    expect(result.tokenUsed).toBe(false);
    expect(result.tokensRemaining).toBe(1);
  });

  it("uses a protection token on misses", () => {
    const result = evaluateStreakForDay({
      previousStreak: 5,
      completionRate: 0.2,
      threshold: 0.8,
      protectionTokens: 2,
      scheduledCount: 5
    });

    expect(result.nextStreak).toBe(5);
    expect(result.tokenUsed).toBe(true);
    expect(result.tokensRemaining).toBe(1);
  });

  it("resets streak when threshold is missed and no token is available", () => {
    const result = evaluateStreakForDay({
      previousStreak: 5,
      completionRate: 0.2,
      threshold: 0.8,
      protectionTokens: 0,
      scheduledCount: 5
    });

    expect(result.nextStreak).toBe(0);
    expect(result.tokenUsed).toBe(false);
  });

  it("computes completion rate and xp", () => {
    const rate = computeCompletionRate(3, 4);
    const xp = computeDailyXpAward({
      scheduledCount: 4,
      completedCount: 4,
      completionRate: 1,
      streakCount: 7
    });

    expect(rate).toBe(0.75);
    expect(xp).toBe(75);
  });
});
