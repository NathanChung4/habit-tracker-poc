import { Habit, HabitScheduleConfig } from "./types";

const DEFAULT_ORDERED_WEEK_DAYS = [1, 2, 3, 4, 5, 6, 0] as const;

export function getDayOfWeek(dateLocal: string): number {
  return new Date(`${dateLocal}T00:00:00Z`).getUTCDay();
}

export function resolveTimesPerWeekDays(config: HabitScheduleConfig): number[] {
  const timesPerWeek = Math.max(1, Math.min(7, config.timesPerWeek ?? 1));
  const preferred = (config.preferredDays ?? DEFAULT_ORDERED_WEEK_DAYS)
    .map((day) => normalizeDay(day))
    .filter((day, index, arr) => arr.indexOf(day) === index);

  const base = preferred.length > 0 ? preferred : [...DEFAULT_ORDERED_WEEK_DAYS];
  return base.slice(0, timesPerWeek);
}

export function isHabitScheduledOnDate(habit: Pick<Habit, "scheduleType" | "scheduleConfig">, dateLocal: string): boolean {
  const dayOfWeek = getDayOfWeek(dateLocal);

  if (habit.scheduleType === "daily") {
    return true;
  }

  if (habit.scheduleType === "weekdays") {
    return dayOfWeek >= 1 && dayOfWeek <= 5;
  }

  if (habit.scheduleType === "custom_days") {
    const configured = (habit.scheduleConfig.daysOfWeek ?? []).map((day) => normalizeDay(day));
    return configured.includes(dayOfWeek);
  }

  const scheduledDays = resolveTimesPerWeekDays(habit.scheduleConfig);
  return scheduledDays.includes(dayOfWeek);
}

export function expandDatesBetween(startDateLocal: string, endDateLocal: string): string[] {
  const result: string[] = [];
  const start = new Date(`${startDateLocal}T00:00:00Z`);
  const end = new Date(`${endDateLocal}T00:00:00Z`);

  if (start > end) {
    return result;
  }

  let current = start;

  while (current <= end) {
    result.push(current.toISOString().slice(0, 10));
    current = new Date(current.getTime() + 24 * 60 * 60 * 1000);
  }

  return result;
}

export function expandScheduledDatesForHabit(
  habit: Pick<Habit, "scheduleType" | "scheduleConfig">,
  startDateLocal: string,
  endDateLocal: string
): string[] {
  return expandDatesBetween(startDateLocal, endDateLocal).filter((dateLocal) => isHabitScheduledOnDate(habit, dateLocal));
}

function normalizeDay(day: number): number {
  if (!Number.isFinite(day)) {
    return 0;
  }

  const normalized = Math.round(day) % 7;
  return normalized < 0 ? normalized + 7 : normalized;
}
