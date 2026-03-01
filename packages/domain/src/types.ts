export type HabitScheduleType = "daily" | "weekdays" | "custom_days" | "times_per_week";

export type HabitStatus = "pending" | "done" | "missed";

export type RewardUnlockStatus = "locked" | "unlocked" | "redeemed";

export type RewardRuleType = "completion_threshold";

export interface HabitScheduleConfig {
  daysOfWeek?: number[];
  timesPerWeek?: number;
  preferredDays?: number[];
}

export interface Habit {
  id: string;
  userId: string;
  title: string;
  notes: string | null;
  scheduleType: HabitScheduleType;
  scheduleConfig: HabitScheduleConfig;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface HabitDayInstance {
  id: string;
  habitId: string;
  userId: string;
  dateLocal: string;
  status: HabitStatus;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DailySummary {
  userId: string;
  dateLocal: string;
  scheduledCount: number;
  completedCount: number;
  completionRate: number;
  streakCount: number;
  tokenUsed: boolean;
  xpAwarded: number;
}

export interface WeeklyConsistency {
  weekStartDate: string;
  averageCompletionRate: number;
  scheduledCount: number;
  completedCount: number;
}

export interface RewardContract {
  id: string;
  userId: string;
  title: string;
  ruleType: RewardRuleType;
  ruleConfig: RewardRuleConfig;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RewardUnlock {
  id: string;
  rewardContractId: string;
  userId: string;
  dateLocal: string;
  status: RewardUnlockStatus;
  redeemedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RewardRuleConfig {
  threshold: number;
}

export interface StreakEvaluationInput {
  previousStreak: number;
  completionRate: number;
  threshold: number;
  protectionTokens: number;
  scheduledCount: number;
}

export interface StreakEvaluationResult {
  nextStreak: number;
  tokenUsed: boolean;
  tokensRemaining: number;
  excludedFromStreak: boolean;
}

export interface ProfileSettings {
  timezone: string;
  dayCutoffMinutes: number;
  streakThreshold: number;
}
