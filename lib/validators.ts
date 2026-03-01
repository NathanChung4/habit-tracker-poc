import { z } from "zod";

export const habitSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional().nullable(),
  frequencyType: z.enum(["daily", "weekdays", "weekends"]).default("daily"),
  targetThreshold: z.number().min(0).max(1).default(0.8)
});

const cutoffTimeRegex = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/;

export const profileSettingsSchema = z.object({
  timezone: z.string().min(1),
  cutoffTime: z
    .string()
    .regex(cutoffTimeRegex, "cutoffTime must be HH:MM or HH:MM:SS")
    .transform((value) => (value.length === 5 ? `${value}:00` : value)),
  protectionTokens: z.number().int().min(0).max(20)
});

export const rewardContractCreateSchema = z.object({
  title: z.string().trim().min(1).max(120),
  threshold: z.number().min(0).max(1).default(1),
  isActive: z.boolean().default(true)
});

export const rewardContractPatchSchema = rewardContractCreateSchema
  .partial()
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "At least one field must be provided."
  });

const dateLocalRegex = /^\d{4}-\d{2}-\d{2}$/;

export const consistencyEventsQuerySchema = z
  .object({
    limit: z.number().int().min(1).max(50).default(20),
    type: z.enum(["streak_evaluated", "token_consumed", "reward_unlocked", "reward_redeemed"]).optional(),
    from: z.string().regex(dateLocalRegex, "from must be YYYY-MM-DD").optional(),
    to: z.string().regex(dateLocalRegex, "to must be YYYY-MM-DD").optional()
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    message: "from must be less than or equal to to"
  });
