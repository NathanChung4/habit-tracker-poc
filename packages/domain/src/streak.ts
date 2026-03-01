import { DailySummary, StreakEvaluationInput, StreakEvaluationResult } from "./types";

export function evaluateStreakForDay(input: StreakEvaluationInput): StreakEvaluationResult {
  const threshold = clamp(input.threshold, 0, 1);
  const safePreviousStreak = Math.max(0, input.previousStreak);
  const safeTokens = Math.max(0, input.protectionTokens);

  if (input.scheduledCount <= 0) {
    return {
      nextStreak: safePreviousStreak,
      tokenUsed: false,
      tokensRemaining: safeTokens,
      excludedFromStreak: true
    };
  }

  if (input.completionRate >= threshold) {
    return {
      nextStreak: safePreviousStreak + 1,
      tokenUsed: false,
      tokensRemaining: safeTokens,
      excludedFromStreak: false
    };
  }

  if (safeTokens > 0) {
    return {
      nextStreak: safePreviousStreak,
      tokenUsed: true,
      tokensRemaining: safeTokens - 1,
      excludedFromStreak: false
    };
  }

  return {
    nextStreak: 0,
    tokenUsed: false,
    tokensRemaining: safeTokens,
    excludedFromStreak: false
  };
}

export function computeCompletionRate(completedCount: number, scheduledCount: number): number {
  if (scheduledCount <= 0) {
    return 0;
  }

  return clamp(completedCount / scheduledCount, 0, 1);
}

export function computeDailyXpAward(
  summary: Pick<DailySummary, "scheduledCount" | "completedCount" | "completionRate" | "streakCount">
): number {
  if (summary.scheduledCount <= 0) {
    return 0;
  }

  const baseXp = summary.completedCount * 10;
  const perfectDayBonus = summary.completionRate >= 1 ? 15 : 0;
  const streakMilestoneBonus = summary.streakCount > 0 && summary.streakCount % 7 === 0 ? 20 : 0;
  return baseXp + perfectDayBonus + streakMilestoneBonus;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
