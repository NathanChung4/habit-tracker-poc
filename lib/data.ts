import type { SupabaseClient } from "@supabase/supabase-js";
import { getEffectiveLocalDate, getWeekStartDate } from "@patternfinder/domain";
import { habitSchema, profileSettingsSchema, rewardContractSchema } from "@/lib/validators";

type DbClient = SupabaseClient<any, "public", any>;

export interface ProfileRow {
  id: string;
  timezone: string;
  day_cutoff_minutes: number;
  streak_threshold: number;
  streak_count: number;
  streak_protection_tokens: number;
  xp: number;
  level: number;
}

export interface HabitRow {
  id: string;
  user_id: string;
  title: string;
  notes: string | null;
  schedule_type: "daily" | "weekdays" | "custom_days" | "times_per_week";
  schedule_config: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TodayInstance {
  id: string;
  habitId: string;
  title: string;
  notes: string | null;
  dateLocal: string;
  status: "pending" | "done" | "missed";
  completedAt: string | null;
}

export interface TodayDashboard {
  profile: ProfileRow;
  dateLocal: string;
  instances: TodayInstance[];
  summary: {
    completionRate: number;
    scheduledCount: number;
    completedCount: number;
    streakCount: number;
    tokenUsed: boolean;
    xpAwarded: number;
  };
  rewardUnlocks: Array<{
    id: string;
    contractId: string;
    title: string;
    status: "locked" | "unlocked" | "redeemed";
  }>;
  badges: Array<{
    code: string;
    name: string;
  }>;
}

export async function ensureProfile(client: DbClient, userId: string): Promise<ProfileRow> {
  const { data, error } = await client
    .from("profiles")
    .select("id, timezone, day_cutoff_minutes, streak_threshold, streak_count, streak_protection_tokens, xp, level")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (data) {
    return data as ProfileRow;
  }

  const { data: created, error: insertError } = await client
    .from("profiles")
    .insert({ id: userId })
    .select("id, timezone, day_cutoff_minutes, streak_threshold, streak_count, streak_protection_tokens, xp, level")
    .single();

  if (insertError) {
    throw insertError;
  }

  return created as ProfileRow;
}

export async function updateProfileSettings(client: DbClient, userId: string, payload: unknown): Promise<ProfileRow> {
  const parsed = profileSettingsSchema.parse(payload);
  await ensureProfile(client, userId);

  const { data, error } = await client
    .from("profiles")
    .update({
      timezone: parsed.timezone,
      day_cutoff_minutes: parsed.dayCutoffMinutes,
      streak_threshold: parsed.streakThreshold
    })
    .eq("id", userId)
    .select("id, timezone, day_cutoff_minutes, streak_threshold, streak_count, streak_protection_tokens, xp, level")
    .single();

  if (error) {
    throw error;
  }

  return data as ProfileRow;
}

export async function ensureDayInstances(client: DbClient, userId: string, dateLocal?: string): Promise<void> {
  const { error } = await client.rpc("generate_day_instances_for_user", {
    p_user: userId,
    p_date: dateLocal ?? null
  });

  if (error) {
    throw error;
  }
}

export async function getTodayDashboard(client: DbClient, userId: string): Promise<TodayDashboard> {
  const profile = await ensureProfile(client, userId);
  const dateLocal = getEffectiveLocalDate(new Date(), profile.timezone, profile.day_cutoff_minutes);

  await ensureDayInstances(client, userId, dateLocal);

  const [{ data: rawInstances, error: instanceError }, { data: summaryData, error: summaryError }] = await Promise.all([
    client
      .from("habit_day_instances")
      .select("id, habit_id, date_local, status, completed_at")
      .eq("user_id", userId)
      .eq("date_local", dateLocal)
      .order("created_at", { ascending: true }),
    client
      .from("daily_summaries")
      .select("completion_rate, scheduled_count, completed_count, streak_count, token_used, xp_awarded")
      .eq("user_id", userId)
      .eq("date_local", dateLocal)
      .maybeSingle()
  ]);

  if (instanceError) {
    throw instanceError;
  }

  if (summaryError) {
    throw summaryError;
  }

  const habitIds = (rawInstances ?? []).map((item: any) => item.habit_id);
  const { data: habits, error: habitsError } = habitIds.length
    ? await client.from("habits").select("id, title, notes").in("id", habitIds)
    : { data: [], error: null };

  if (habitsError) {
    throw habitsError;
  }

  const habitMap = new Map((habits ?? []).map((habit: any) => [habit.id, habit]));

  const instances: TodayInstance[] = (rawInstances ?? []).map((instance: any) => ({
    id: instance.id,
    habitId: instance.habit_id,
    title: habitMap.get(instance.habit_id)?.title ?? "Untitled Habit",
    notes: habitMap.get(instance.habit_id)?.notes ?? null,
    dateLocal: instance.date_local,
    status: instance.status,
    completedAt: instance.completed_at
  }));

  const [{ data: unlockRows, error: unlockError }, { data: badgeRows, error: badgeError }] = await Promise.all([
    client
      .from("reward_unlocks")
      .select("id, reward_contract_id, status")
      .eq("user_id", userId)
      .eq("date_local", dateLocal)
      .order("created_at", { ascending: true }),
    client
      .from("user_badges")
      .select("badges(code, name)")
      .eq("user_id", userId)
      .order("awarded_at", { ascending: false })
      .limit(6)
  ]);

  if (unlockError) {
    throw unlockError;
  }

  if (badgeError) {
    throw badgeError;
  }

  const contractIds = (unlockRows ?? []).map((row: any) => row.reward_contract_id);
  const { data: contracts, error: contractsError } = contractIds.length
    ? await client.from("reward_contracts").select("id, title").in("id", contractIds)
    : { data: [], error: null };

  if (contractsError) {
    throw contractsError;
  }

  const contractMap = new Map((contracts ?? []).map((contract: any) => [contract.id, contract.title]));

  return {
    profile,
    dateLocal,
    instances,
    summary: {
      completionRate: summaryData?.completion_rate ?? 0,
      scheduledCount: summaryData?.scheduled_count ?? instances.length,
      completedCount:
        summaryData?.completed_count ?? instances.filter((instance) => instance.status === "done").length,
      streakCount: summaryData?.streak_count ?? profile.streak_count,
      tokenUsed: summaryData?.token_used ?? false,
      xpAwarded: summaryData?.xp_awarded ?? 0
    },
    rewardUnlocks: (unlockRows ?? []).map((row: any) => ({
      id: row.id,
      contractId: row.reward_contract_id,
      title: contractMap.get(row.reward_contract_id) ?? "Reward",
      status: row.status
    })),
    badges: (badgeRows ?? []).flatMap((row: any) => {
      if (!row.badges) {
        return [];
      }

      if (Array.isArray(row.badges)) {
        return row.badges.map((badge) => ({ code: badge.code, name: badge.name }));
      }

      return [{ code: row.badges.code, name: row.badges.name }];
    })
  };
}

export async function listHabits(client: DbClient, userId: string): Promise<HabitRow[]> {
  const { data, error } = await client
    .from("habits")
    .select("id, user_id, title, notes, schedule_type, schedule_config, is_active, created_at, updated_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as HabitRow[];
}

export async function createHabit(client: DbClient, userId: string, payload: unknown): Promise<HabitRow> {
  const parsed = habitSchema.parse(payload);

  const { data, error } = await client
    .from("habits")
    .insert({
      user_id: userId,
      title: parsed.title,
      notes: parsed.notes ?? null,
      schedule_type: parsed.scheduleType,
      schedule_config: parsed.scheduleConfig,
      is_active: true
    })
    .select("id, user_id, title, notes, schedule_type, schedule_config, is_active, created_at, updated_at")
    .single();

  if (error) {
    throw error;
  }

  return data as HabitRow;
}

export async function updateHabit(client: DbClient, userId: string, habitId: string, payload: unknown): Promise<HabitRow> {
  const parsed = habitSchema.partial().parse(payload);

  const updatePayload: Record<string, unknown> = {};

  if (parsed.title !== undefined) updatePayload.title = parsed.title;
  if (parsed.notes !== undefined) updatePayload.notes = parsed.notes;
  if (parsed.scheduleType !== undefined) updatePayload.schedule_type = parsed.scheduleType;
  if (parsed.scheduleConfig !== undefined) updatePayload.schedule_config = parsed.scheduleConfig;

  const { data, error } = await client
    .from("habits")
    .update(updatePayload)
    .eq("id", habitId)
    .eq("user_id", userId)
    .select("id, user_id, title, notes, schedule_type, schedule_config, is_active, created_at, updated_at")
    .single();

  if (error) {
    throw error;
  }

  return data as HabitRow;
}

export async function deleteHabit(client: DbClient, userId: string, habitId: string): Promise<void> {
  const { error } = await client.from("habits").delete().eq("id", habitId).eq("user_id", userId);

  if (error) {
    throw error;
  }
}

export async function toggleDayInstance(client: DbClient, userId: string, instanceId: string) {
  const profile = await ensureProfile(client, userId);
  const effectiveDate = getEffectiveLocalDate(new Date(), profile.timezone, profile.day_cutoff_minutes);

  const { data: instance, error: instanceError } = await client
    .from("habit_day_instances")
    .select("id, date_local, status")
    .eq("id", instanceId)
    .eq("user_id", userId)
    .single();

  if (instanceError) {
    throw instanceError;
  }

  if (instance.date_local < effectiveDate) {
    throw new Error("This day is already closed.");
  }

  const nextStatus = instance.status === "done" ? "pending" : "done";

  const { data, error } = await client
    .from("habit_day_instances")
    .update({
      status: nextStatus,
      completed_at: nextStatus === "done" ? new Date().toISOString() : null
    })
    .eq("id", instanceId)
    .eq("user_id", userId)
    .select("id, habit_id, date_local, status, completed_at")
    .single();

  if (error) {
    throw error;
  }

  const [summaryRpc, unlockRpc, badgeRpc] = await Promise.all([
    client.rpc("recompute_daily_summary", { p_user: userId, p_date: instance.date_local }),
    client.rpc("refresh_reward_unlocks", { p_user: userId, p_date: instance.date_local }),
    client.rpc("award_badges_for_day", { p_user: userId, p_date: instance.date_local })
  ]);

  if (summaryRpc.error) throw summaryRpc.error;
  if (unlockRpc.error) throw unlockRpc.error;
  if (badgeRpc.error) throw badgeRpc.error;

  return data;
}

export async function getDailyReport(client: DbClient, userId: string, startDate?: string, endDate?: string) {
  const fromDate = startDate ?? new Date(Date.now() - 13 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const toDate = endDate ?? new Date().toISOString().slice(0, 10);

  const { data, error } = await client
    .from("daily_summaries")
    .select("date_local, completion_rate, scheduled_count, completed_count, streak_count, token_used, xp_awarded")
    .eq("user_id", userId)
    .gte("date_local", fromDate)
    .lte("date_local", toDate)
    .order("date_local", { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getWeeklyReport(client: DbClient, userId: string, weeks = 8) {
  const daily = await getDailyReport(
    client,
    userId,
    new Date(Date.now() - weeks * 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    new Date().toISOString().slice(0, 10)
  );

  const groups = new Map<
    string,
    {
      weekStartDate: string;
      completionRateSum: number;
      dayCount: number;
      scheduledCount: number;
      completedCount: number;
    }
  >();

  for (const row of daily as any[]) {
    if ((row.scheduled_count ?? 0) <= 0) {
      continue;
    }

    const weekStartDate = getWeekStartDate(row.date_local);
    const current = groups.get(weekStartDate) ?? {
      weekStartDate,
      completionRateSum: 0,
      dayCount: 0,
      scheduledCount: 0,
      completedCount: 0
    };

    current.completionRateSum += Number(row.completion_rate ?? 0);
    current.dayCount += 1;
    current.scheduledCount += Number(row.scheduled_count ?? 0);
    current.completedCount += Number(row.completed_count ?? 0);

    groups.set(weekStartDate, current);
  }

  return [...groups.values()]
    .map((group) => ({
      weekStartDate: group.weekStartDate,
      averageCompletionRate: group.dayCount > 0 ? group.completionRateSum / group.dayCount : 0,
      scheduledCount: group.scheduledCount,
      completedCount: group.completedCount
    }))
    .sort((a, b) => a.weekStartDate.localeCompare(b.weekStartDate));
}

export async function listRewardContracts(client: DbClient, userId: string) {
  const { data, error } = await client
    .from("reward_contracts")
    .select("id, title, rule_type, rule_config, is_active, created_at, updated_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function listRewardUnlocks(client: DbClient, userId: string, limit = 20) {
  const { data, error } = await client
    .from("reward_unlocks")
    .select("id, reward_contract_id, date_local, status, redeemed_at, created_at")
    .eq("user_id", userId)
    .order("date_local", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  const contractIds = (data ?? []).map((item: any) => item.reward_contract_id);
  const contracts = contractIds.length
    ? await client.from("reward_contracts").select("id, title").in("id", contractIds)
    : { data: [], error: null };

  if (contracts.error) {
    throw contracts.error;
  }

  const titleById = new Map((contracts.data ?? []).map((contract: any) => [contract.id, contract.title]));

  return (data ?? []).map((row: any) => ({
    ...row,
    contract_title: titleById.get(row.reward_contract_id) ?? "Reward"
  }));
}

export async function createRewardContract(client: DbClient, userId: string, payload: unknown) {
  const parsed = rewardContractSchema.parse(payload);

  const { data, error } = await client
    .from("reward_contracts")
    .insert({
      user_id: userId,
      title: parsed.title,
      rule_type: "completion_threshold",
      rule_config: { threshold: parsed.threshold },
      is_active: parsed.isActive
    })
    .select("id, title, rule_type, rule_config, is_active, created_at, updated_at")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateRewardContract(client: DbClient, userId: string, contractId: string, payload: unknown) {
  const parsed = rewardContractSchema.partial().parse(payload);

  const updatePayload: Record<string, unknown> = {};

  if (parsed.title !== undefined) {
    updatePayload.title = parsed.title;
  }

  if (parsed.threshold !== undefined) {
    updatePayload.rule_config = { threshold: parsed.threshold };
  }

  if (parsed.isActive !== undefined) {
    updatePayload.is_active = parsed.isActive;
  }

  const { data, error } = await client
    .from("reward_contracts")
    .update(updatePayload)
    .eq("id", contractId)
    .eq("user_id", userId)
    .select("id, title, rule_type, rule_config, is_active, created_at, updated_at")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function redeemRewardUnlock(client: DbClient, userId: string, unlockId: string) {
  const { data, error } = await client
    .from("reward_unlocks")
    .update({
      status: "redeemed",
      redeemed_at: new Date().toISOString()
    })
    .eq("id", unlockId)
    .eq("user_id", userId)
    .eq("status", "unlocked")
    .select("id, status, redeemed_at")
    .single();

  if (error) {
    throw error;
  }

  return data;
}
