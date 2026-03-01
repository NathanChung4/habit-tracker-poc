import { describe, expect, it } from "vitest";
import { expandScheduledDatesForHabit, isHabitScheduledOnDate } from "../src/schedule";

describe("schedule", () => {
  it("supports weekdays schedule", () => {
    const habit = {
      scheduleType: "weekdays" as const,
      scheduleConfig: {}
    };

    expect(isHabitScheduledOnDate(habit, "2026-03-02")).toBe(true); // Monday
    expect(isHabitScheduledOnDate(habit, "2026-03-01")).toBe(false); // Sunday
  });

  it("supports custom days", () => {
    const habit = {
      scheduleType: "custom_days" as const,
      scheduleConfig: { daysOfWeek: [0, 2, 4] }
    };

    expect(isHabitScheduledOnDate(habit, "2026-03-01")).toBe(true);
    expect(isHabitScheduledOnDate(habit, "2026-03-02")).toBe(false);
    expect(isHabitScheduledOnDate(habit, "2026-03-03")).toBe(true);
  });

  it("supports times per week", () => {
    const habit = {
      scheduleType: "times_per_week" as const,
      scheduleConfig: { timesPerWeek: 3, preferredDays: [1, 3, 5] }
    };

    expect(isHabitScheduledOnDate(habit, "2026-03-02")).toBe(true); // Monday
    expect(isHabitScheduledOnDate(habit, "2026-03-04")).toBe(true); // Wednesday
    expect(isHabitScheduledOnDate(habit, "2026-03-06")).toBe(true); // Friday
    expect(isHabitScheduledOnDate(habit, "2026-03-07")).toBe(false); // Saturday
  });

  it("expands dates in a range", () => {
    const habit = {
      scheduleType: "custom_days" as const,
      scheduleConfig: { daysOfWeek: [1, 3] }
    };

    expect(expandScheduledDatesForHabit(habit, "2026-03-01", "2026-03-07")).toEqual(["2026-03-02", "2026-03-04"]);
  });
});
