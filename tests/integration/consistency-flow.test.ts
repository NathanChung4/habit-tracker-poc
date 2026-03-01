import { describe, expect, it } from "vitest";
import {
  computeCompletionRate,
  evaluateRewardUnlock,
  evaluateStreakForDay,
  isHabitScheduledOnDate,
  type Habit
} from "@patternfinder/domain";

function buildHabit(partial: Partial<Habit>): Habit {
  return {
    id: "habit-1",
    userId: "user-1",
    title: "Gym",
    notes: null,
    scheduleType: "daily",
    scheduleConfig: {},
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...partial
  };
}

describe("consistency flow", () => {
  it("schedules habits and computes daily summary", () => {
    const habit = buildHabit({ scheduleType: "weekdays" });

    const isMondayScheduled = isHabitScheduledOnDate(habit, "2026-03-02");
    const isSundayScheduled = isHabitScheduledOnDate(habit, "2026-03-01");

    expect(isMondayScheduled).toBe(true);
    expect(isSundayScheduled).toBe(false);

    const completionRate = computeCompletionRate(4, 5);
    expect(completionRate).toBe(0.8);

    const streak = evaluateStreakForDay({
      previousStreak: 4,
      completionRate,
      threshold: 0.8,
      protectionTokens: 1,
      scheduledCount: 5
    });

    expect(streak.nextStreak).toBe(5);
    expect(streak.tokenUsed).toBe(false);

    const unlocked = evaluateRewardUnlock({ completionRate }, { threshold: 0.8 });
    expect(unlocked).toBe(true);
  });

  it("uses protection token on a miss and keeps reward locked", () => {
    const completionRate = computeCompletionRate(1, 4);

    const streak = evaluateStreakForDay({
      previousStreak: 7,
      completionRate,
      threshold: 0.8,
      protectionTokens: 1,
      scheduledCount: 4
    });

    expect(streak.tokenUsed).toBe(true);
    expect(streak.nextStreak).toBe(7);

    const unlocked = evaluateRewardUnlock({ completionRate }, { threshold: 1 });
    expect(unlocked).toBe(false);
  });
});
