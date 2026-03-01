import { z } from "zod";

const daysOfWeekSchema = z.array(z.number().int().min(0).max(6)).max(7);

export const habitSchema = z.object({
  title: z.string().trim().min(1).max(120),
  notes: z.string().trim().max(500).optional().nullable(),
  scheduleType: z.enum(["daily", "weekdays", "custom_days", "times_per_week"]),
  scheduleConfig: z
    .object({
      daysOfWeek: daysOfWeekSchema.optional(),
      timesPerWeek: z.number().int().min(1).max(7).optional(),
      preferredDays: daysOfWeekSchema.optional()
    })
    .default({})
});

export const profileSettingsSchema = z.object({
  timezone: z.string().min(1),
  dayCutoffMinutes: z.number().int().min(0).max(1439),
  streakThreshold: z.number().min(0).max(1)
});

export const rewardContractSchema = z.object({
  title: z.string().trim().min(1).max(120),
  threshold: z.number().min(0).max(1).default(1),
  isActive: z.boolean().default(true)
});
