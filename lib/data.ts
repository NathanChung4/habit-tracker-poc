import type { SupabaseClient } from "@supabase/supabase-js";
import { expandDatesBetween, getEffectiveLocalDate, getWeekStartDate, shiftDateLocal } from "@patternfinder/domain";
import { habitSchema, profileSettingsSchema, rewardContractCreateSchema } from "@/lib/validators";

type DbClient = SupabaseClient<any, "public", any>;

const STREAK_THRESHOLD = 0.8;
const DEFAULT_REPORT_DAYS = 14;

export interface ProfileRow {
  id: string;
  timezone: string;
  cutoff_time: string;
  protection_tokens: number;
}

export interface HabitRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  frequency_type: string;
  target_threshold: number;
  created_at: string;
}

export interface RewardContractRow {
  id: string;
  user_id: string;
  title: string;
  rule_type: string;
  threshold: number;
  is_active: boolean;
  created_at: string;
}

export interface RewardUnlockRow {
  id: string;
  reward_contract_id: string;
  title: string;
  threshold: number;
  status: "locked" | "unlocked" | "redeemed";
}

export interface RewardHistoryRow {
  id: string;
  reward_contract_id: string;
  title: string;
  date_local: string;
  redeemed_at: string | null;
}

export interface TodayHabitItem {
  id: string;
  name: string;
  description: string | null;
  status: "pending" | "done";
}

export interface TodayDashboard {
  profile: ProfileRow;
  dateLocal: string;
  habits: TodayHabitItem[];
  rewardUnlocks: RewardUnlockRow[];
  rewardHistory: RewardHistoryRow[];
  summary: {
    completionRate: number;
    scheduledCount: number;
    completedCount: number;
    streakCount: number;
    tokenUsed: boolean;
    threshold: number;
    weeklyRedeemedCount: number;
  };
}

interface DailyConsistencyRow {
  date_local: string;
  completion_rate: number;
  scheduled_count: number;
  completed_count: number;
  streak_count: number;
  token_used: boolean;
}

export async function ensureProfile(client: DbClient, userId: string): Promise<ProfileRow> {
  const { data, error } = await client
    .from("profiles")
    .select("id, timezone, cutoff_time, protection_tokens")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  if (data) return data as ProfileRow;

  const { data: created, error: insertError } = await client
    .from("profiles")
    .insert({ id: userId })
    .select("id, timezone, cutoff_time, protection_tokens")
    .single();

  if (insertError) throw insertError;
  return created as ProfileRow;
}

export async function updateProfileSettings(client: DbClient, userId: string, payload: unknown): Promise<ProfileRow> {
  const parsed = profileSettingsSchema.parse(payload);
  await ensureProfile(client, userId);

  const { data, error } = await client
    .from("profiles")
    .update({
      timezone: parsed.timezone,
      cutoff_time: parsed.cutoffTime,
      protection_tokens: parsed.protectionTokens
    })
    .eq("id", userId)
    .select("id, timezone, cutoff_time, protection_tokens")
    .single();

  if (error) throw error;
  return data as ProfileRow;
}

export async function listHabits(client: DbClient, userId: string): Promise<HabitRow[]> {
  const { data, error } = await client
    .from("habits")
    .select("id, user_id, name, description, frequency_type, target_threshold, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as HabitRow[];
}

export async function createHabit(client: DbClient, userId: string, payload: unknown): Promise<HabitRow> {
  const parsed = habitSchema.parse(payload);
  await ensureProfile(client, userId);

  const { data, error } = await client
    .from("habits")
    .insert({
      user_id: userId,
      name: parsed.name,
      description: parsed.description ?? null,
      frequency_type: parsed.frequencyType,
      target_threshold: parsed.targetThreshold
    })
    .select("id, user_id, name, description, frequency_type, target_threshold, created_at")
    .single();

  if (error) throw error;
  return data as HabitRow;
}

export async function updateHabit(client: DbClient, userId: string, habitId: string, payload: unknown): Promise<HabitRow> {
  const parsed = habitSchema.partial().parse(payload);
  const updatePayload: Record<string, unknown> = {};

  if (parsed.name !== undefined) updatePayload.name = parsed.name;
  if (parsed.description !== undefined) updatePayload.description = parsed.description;
  if (parsed.frequencyType !== undefined) updatePayload.frequency_type = parsed.frequencyType;
  if (parsed.targetThreshold !== undefined) updatePayload.target_threshold = parsed.targetThreshold;

  const { data, error } = await client
    .from("habits")
    .update(updatePayload)
    .eq("id", habitId)
    .eq("user_id", userId)
    .select("id, user_id, name, description, frequency_type, target_threshold, created_at")
    .single();

  if (error) throw error;
  return data as HabitRow;
}

export async function deleteHabit(client: DbClient, userId: string, habitId: string): Promise<void> {
  const { error } = await client.from("habits").delete().eq("id", habitId).eq("user_id", userId);
  if (error) throw error;
}

export async function getTodayDashboard(client: DbClient, userId: string): Promise<TodayDashboard> {
  const profile = await ensureProfile(client, userId);
  const dateLocal = getEffectiveLocalDate(new Date(), profile.timezone, cutoffTimeToMinutes(profile.cutoff_time));
  const habits = await listHabits(client, userId);
  const completion = await computeCompletionForDate(client, userId, habits, dateLocal);
  const activeRewardContracts = (await listRewardContracts(client, userId)).filter((contract) => contract.is_active);
  await refreshRewardUnlocksForDate(client, userId, dateLocal, completion.completionRate, activeRewardContracts);
  const [rewardUnlocks, rewardHistory] = await Promise.all([
    listRewardUnlocksForDate(client, userId, dateLocal, activeRewardContracts),
    listRecentRewardHistory(client, userId, 7)
  ]);
  const weeklyRedeemedCount = await getWeeklyRedeemedCount(client, userId, dateLocal);

  const streakState = await computeCurrentStreak(client, userId, profile, habits, dateLocal);

  return {
    profile,
    dateLocal,
    habits: completion.scheduledHabits.map((habit) => ({
      id: habit.id,
      name: habit.name,
      description: habit.description,
      status: completion.completedHabitIds.has(habit.id) ? "done" : "pending"
    })),
    rewardUnlocks,
    rewardHistory,
    summary: {
      completionRate: completion.completionRate,
      scheduledCount: completion.scheduledCount,
      completedCount: completion.completedCount,
      streakCount: streakState.streakCount,
      tokenUsed: streakState.tokenUsed,
      threshold: STREAK_THRESHOLD,
      weeklyRedeemedCount
    }
  };
}

export async function toggleDayInstance(client: DbClient, userId: string, habitId: string) {
  const profile = await ensureProfile(client, userId);
  const dateLocal = getEffectiveLocalDate(new Date(), profile.timezone, cutoffTimeToMinutes(profile.cutoff_time));

  const { data: habit, error: habitError } = await client
    .from("habits")
    .select("id, frequency_type")
    .eq("id", habitId)
    .eq("user_id", userId)
    .maybeSingle();

  if (habitError) throw habitError;
  if (!habit) throw new Error("Habit not found.");

  if (!isHabitScheduledOnDate(habit.frequency_type, dateLocal)) {
    throw new Error("This habit is not scheduled for today.");
  }

  const { data: existingLogs, error: existingError } = await client
    .from("habit_logs")
    .select("id")
    .eq("habit_id", habitId)
    .eq("user_id", userId)
    .eq("completed_at", dateLocal);

  if (existingError) throw existingError;

  let status: "pending" | "done";

  if ((existingLogs ?? []).length > 0) {
    const { error: deleteError } = await client
      .from("habit_logs")
      .delete()
      .eq("habit_id", habitId)
      .eq("user_id", userId)
      .eq("completed_at", dateLocal);

    if (deleteError) throw deleteError;
    status = "pending";
  } else {
    const { error: insertError } = await client.from("habit_logs").insert({
      habit_id: habitId,
      user_id: userId,
      completed_at: dateLocal,
      value: 1.0,
      metadata: { source: "toggle" }
    });

    if (insertError) throw insertError;
    status = "done";
  }

  const habits = await listHabits(client, userId);
  const completion = await computeCompletionForDate(client, userId, habits, dateLocal);
  const activeRewardContracts = (await listRewardContracts(client, userId)).filter((contract) => contract.is_active);
  await refreshRewardUnlocksForDate(client, userId, dateLocal, completion.completionRate, activeRewardContracts);

  return { habitId, dateLocal, status };
}

export async function getDailyReport(client: DbClient, userId: string, startDate?: string, endDate?: string) {
  const profile = await ensureProfile(client, userId);
  const habits = await listHabits(client, userId);

  const todayLocal = getEffectiveLocalDate(new Date(), profile.timezone, cutoffTimeToMinutes(profile.cutoff_time));
  const fromDate = startDate ?? shiftDateLocal(todayLocal, -(DEFAULT_REPORT_DAYS - 1));
  const toDate = endDate ?? todayLocal;

  if (fromDate > toDate) {
    return [];
  }

  return computeDailyRows(client, userId, habits, profile.protection_tokens, fromDate, toDate, todayLocal);
}

export async function getWeeklyReport(client: DbClient, userId: string, weeks = 8) {
  const safeWeeks = Math.max(1, Math.min(52, weeks));
  const profile = await ensureProfile(client, userId);
  const todayLocal = getEffectiveLocalDate(new Date(), profile.timezone, cutoffTimeToMinutes(profile.cutoff_time));
  const daily = await getDailyReport(
    client,
    userId,
    shiftDateLocal(todayLocal, -safeWeeks * 7),
    todayLocal
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

  for (const row of daily) {
    if (row.scheduled_count <= 0) continue;

    const weekStartDate = getWeekStartDate(row.date_local);
    const current = groups.get(weekStartDate) ?? {
      weekStartDate,
      completionRateSum: 0,
      dayCount: 0,
      scheduledCount: 0,
      completedCount: 0
    };

    current.completionRateSum += row.completion_rate;
    current.dayCount += 1;
    current.scheduledCount += row.scheduled_count;
    current.completedCount += row.completed_count;
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

export async function listRewardContracts(client: DbClient, userId: string): Promise<RewardContractRow[]> {
  const { data, error } = await client
    .from("reward_contracts")
    .select("id, user_id, title, rule_type, threshold, is_active, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (!error) {
    return (data ?? []).map((row: any) => ({
      id: row.id,
      user_id: row.user_id,
      title: row.title,
      rule_type: row.rule_type ?? "completion_threshold",
      threshold: Number(row.threshold ?? 1),
      is_active: Boolean(row.is_active),
      created_at: row.created_at
    }));
  }

  // Compatibility path for older reward_contracts schema where threshold is embedded in rule_config.
  if (String((error as any).code ?? "") === "42703") {
    const legacy = await client
      .from("reward_contracts")
      .select("id, user_id, title, rule_type, rule_config, is_active, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (legacy.error) throw legacy.error;

    return (legacy.data ?? []).map((row: any) => ({
      id: row.id,
      user_id: row.user_id,
      title: row.title,
      rule_type: row.rule_type ?? "completion_threshold",
      threshold: Number(row.rule_config?.threshold ?? 1),
      is_active: Boolean(row.is_active),
      created_at: row.created_at
    }));
  }

  throw error;
}

export async function createRewardContract(client: DbClient, userId: string, payload: unknown): Promise<RewardContractRow> {
  const parsed = rewardContractCreateSchema.parse(payload);

  const nextRecord = {
    user_id: userId,
    title: parsed.title,
    rule_type: "completion_threshold",
    threshold: parsed.threshold,
    is_active: parsed.isActive
  };

  const primary = await client
    .from("reward_contracts")
    .insert(nextRecord)
    .select("id, user_id, title, rule_type, threshold, is_active, created_at")
    .single();

  if (!primary.error) {
    const row: any = primary.data;
    return {
      id: row.id,
      user_id: row.user_id,
      title: row.title,
      rule_type: row.rule_type ?? "completion_threshold",
      threshold: Number(row.threshold ?? 1),
      is_active: Boolean(row.is_active),
      created_at: row.created_at
    };
  }

  if (String((primary.error as any).code ?? "") === "42703") {
    const legacy = await client
      .from("reward_contracts")
      .insert({
        user_id: userId,
        title: parsed.title,
        rule_type: "completion_threshold",
        rule_config: { threshold: parsed.threshold },
        is_active: parsed.isActive
      })
      .select("id, user_id, title, rule_type, rule_config, is_active, created_at")
      .single();

    if (legacy.error) throw legacy.error;
    const row: any = legacy.data;
    return {
      id: row.id,
      user_id: row.user_id,
      title: row.title,
      rule_type: row.rule_type ?? "completion_threshold",
      threshold: Number(row.rule_config?.threshold ?? 1),
      is_active: Boolean(row.is_active),
      created_at: row.created_at
    };
  }

  throw primary.error;
}

export async function redeemRewardUnlock(client: DbClient, userId: string, unlockId: string) {
  const result = await client
    .from("reward_unlocks")
    .update({
      status: "redeemed",
      redeemed_at: new Date().toISOString()
    })
    .eq("id", unlockId)
    .eq("user_id", userId)
    .eq("status", "unlocked")
    .select("id, reward_contract_id, status, redeemed_at")
    .maybeSingle();

  if (result.error) {
    if (String((result.error as any).code ?? "") === "42P01") {
      throw new Error("Rewards schema not ready yet. Run latest migrations.");
    }
    throw result.error;
  }

  if (!result.data) {
    throw new Error("Reward is not redeemable.");
  }

  return result.data;
}

async function computeCompletionForDate(
  client: DbClient,
  userId: string,
  habits: HabitRow[],
  dateLocal: string
): Promise<{
  scheduledHabits: HabitRow[];
  completedHabitIds: Set<string>;
  scheduledCount: number;
  completedCount: number;
  completionRate: number;
}> {
  const scheduledHabits = habits.filter((habit) => isHabitScheduledOnDate(habit.frequency_type, dateLocal));
  const completedHabitIds = await getCompletedHabitIdsForDate(
    client,
    userId,
    dateLocal,
    scheduledHabits.map((habit) => habit.id)
  );

  const scheduledCount = scheduledHabits.length;
  const completedCount = scheduledHabits.filter((habit) => completedHabitIds.has(habit.id)).length;
  const completionRate = scheduledCount > 0 ? completedCount / scheduledCount : 0;

  return {
    scheduledHabits,
    completedHabitIds,
    scheduledCount,
    completedCount,
    completionRate
  };
}

async function refreshRewardUnlocksForDate(
  client: DbClient,
  userId: string,
  dateLocal: string,
  completionRate: number,
  activeContracts: RewardContractRow[]
): Promise<void> {
  if (activeContracts.length === 0) {
    return;
  }

  const contractIds = activeContracts.map((contract) => contract.id);
  const existing = await client
    .from("reward_unlocks")
    .select("reward_contract_id, status")
    .eq("user_id", userId)
    .eq("date_local", dateLocal)
    .in("reward_contract_id", contractIds);

  if (existing.error) {
    // Compatibility path: if table does not exist yet, skip without crashing today page.
    if (String((existing.error as any).code ?? "") === "42P01") {
      return;
    }

    throw existing.error;
  }

  const existingStatusByContract = new Map<string, string>(
    (existing.data ?? []).map((row: any) => [String(row.reward_contract_id), String(row.status)])
  );

  const rows = activeContracts.map((contract) => {
    const existingStatus = existingStatusByContract.get(contract.id);
    const computedStatus: "locked" | "unlocked" = completionRate >= contract.threshold ? "unlocked" : "locked";

    return {
      reward_contract_id: contract.id,
      user_id: userId,
      date_local: dateLocal,
      status: existingStatus === "redeemed" ? "redeemed" : computedStatus
    };
  });

  const upsertResult = await client.from("reward_unlocks").upsert(rows, {
    onConflict: "reward_contract_id,date_local"
  });

  if (upsertResult.error) {
    throw upsertResult.error;
  }
}

async function listRewardUnlocksForDate(
  client: DbClient,
  userId: string,
  dateLocal: string,
  activeContracts: RewardContractRow[]
): Promise<RewardUnlockRow[]> {
  if (activeContracts.length === 0) {
    return [];
  }

  const contractIds = activeContracts.map((contract) => contract.id);
  const result = await client
    .from("reward_unlocks")
    .select("id, reward_contract_id, status")
    .eq("user_id", userId)
    .eq("date_local", dateLocal)
    .in("reward_contract_id", contractIds);

  if (result.error) {
    if (String((result.error as any).code ?? "") === "42P01") {
      return activeContracts.map((contract) => ({
        id: `${contract.id}:${dateLocal}`,
        reward_contract_id: contract.id,
        title: contract.title,
        threshold: contract.threshold,
        status: "locked"
      }));
    }

    throw result.error;
  }

  const unlockByContract = new Map<string, any>((result.data ?? []).map((row: any) => [String(row.reward_contract_id), row]));

  return activeContracts.map((contract) => {
    const unlock = unlockByContract.get(contract.id);
    const rawStatus = String(unlock?.status ?? "locked");
    const normalizedStatus: "locked" | "unlocked" | "redeemed" =
      rawStatus === "redeemed" ? "redeemed" : rawStatus === "unlocked" ? "unlocked" : "locked";

    return {
      id: String(unlock?.id ?? `${contract.id}:${dateLocal}`),
      reward_contract_id: contract.id,
      title: contract.title,
      threshold: contract.threshold,
      status: normalizedStatus
    };
  });
}

async function listRecentRewardHistory(client: DbClient, userId: string, limit: number): Promise<RewardHistoryRow[]> {
  const safeLimit = Math.max(1, Math.min(limit, 30));

  const rows = await client
    .from("reward_unlocks")
    .select("id, reward_contract_id, date_local, redeemed_at")
    .eq("user_id", userId)
    .eq("status", "redeemed")
    .order("redeemed_at", { ascending: false })
    .limit(safeLimit);

  if (rows.error) {
    if (String((rows.error as any).code ?? "") === "42P01") {
      return [];
    }
    throw rows.error;
  }

  const contractIds = [...new Set((rows.data ?? []).map((row: any) => String(row.reward_contract_id)))];
  const contracts =
    contractIds.length > 0
      ? await client.from("reward_contracts").select("id, title").in("id", contractIds)
      : { data: [], error: null };

  if (contracts.error) {
    throw contracts.error;
  }

  const titleByContractId = new Map<string, string>(
    (contracts.data ?? []).map((contract: any) => [String(contract.id), String(contract.title)])
  );

  return (rows.data ?? []).map((row: any) => ({
    id: String(row.id),
    reward_contract_id: String(row.reward_contract_id),
    title: titleByContractId.get(String(row.reward_contract_id)) ?? "Reward",
    date_local: String(row.date_local),
    redeemed_at: row.redeemed_at ? String(row.redeemed_at) : null
  }));
}

async function getWeeklyRedeemedCount(client: DbClient, userId: string, todayLocal: string): Promise<number> {
  const startDate = shiftDateLocal(todayLocal, -6);

  const countQuery = await client
    .from("reward_unlocks")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "redeemed")
    .gte("date_local", startDate)
    .lte("date_local", todayLocal);

  if (countQuery.error) {
    if (String((countQuery.error as any).code ?? "") === "42P01") {
      return 0;
    }
    throw countQuery.error;
  }

  return Number(countQuery.count ?? 0);
}

async function computeCurrentStreak(
  client: DbClient,
  userId: string,
  profile: ProfileRow,
  habits: HabitRow[],
  todayLocal: string
): Promise<{ streakCount: number; tokenUsed: boolean }> {
  const lookbackStart = shiftDateLocal(todayLocal, -120);
  const dailyRows = await computeDailyRows(
    client,
    userId,
    habits,
    profile.protection_tokens,
    lookbackStart,
    todayLocal,
    todayLocal
  );

  if (dailyRows.length === 0) {
    return { streakCount: 0, tokenUsed: false };
  }

  const lastRow = dailyRows[dailyRows.length - 1];
  return {
    streakCount: lastRow.streak_count,
    tokenUsed: lastRow.token_used
  };
}

async function computeDailyRows(
  client: DbClient,
  userId: string,
  habits: HabitRow[],
  protectionTokens: number,
  fromDate: string,
  toDate: string,
  todayLocal: string
): Promise<DailyConsistencyRow[]> {
  const dates = expandDatesBetween(fromDate, toDate);
  if (dates.length === 0) return [];

  const habitIds = habits.map((habit) => habit.id);
  const logsByDate = await getCompletedHabitIdsByDate(client, userId, fromDate, toDate, habitIds);

  let streakCount = 0;
  let tokensRemaining = Math.max(0, protectionTokens);

  const rows: DailyConsistencyRow[] = [];

  for (const dateLocal of dates) {
    const scheduledHabits = habits.filter((habit) => isHabitScheduledOnDate(habit.frequency_type, dateLocal));
    const scheduledCount = scheduledHabits.length;
    const completedSet = logsByDate.get(dateLocal) ?? new Set<string>();
    const completedCount = scheduledHabits.filter((habit) => completedSet.has(habit.id)).length;
    const completionRate = scheduledCount > 0 ? completedCount / scheduledCount : 0;

    let tokenUsed = false;

    if (scheduledCount > 0) {
      if (completionRate >= STREAK_THRESHOLD) {
        streakCount += 1;
      } else if (dateLocal === todayLocal) {
        // Do not consume a token on an open day.
      } else if (tokensRemaining > 0) {
        tokensRemaining -= 1;
        tokenUsed = true;
        streakCount += 1;
      } else {
        streakCount = 0;
      }
    }

    rows.push({
      date_local: dateLocal,
      completion_rate: completionRate,
      scheduled_count: scheduledCount,
      completed_count: completedCount,
      streak_count: streakCount,
      token_used: tokenUsed
    });
  }

  return rows;
}

async function getCompletedHabitIdsForDate(
  client: DbClient,
  userId: string,
  dateLocal: string,
  habitIds: string[]
): Promise<Set<string>> {
  if (habitIds.length === 0) return new Set();

  const { data, error } = await client
    .from("habit_logs")
    .select("habit_id")
    .eq("user_id", userId)
    .eq("completed_at", dateLocal)
    .in("habit_id", habitIds);

  if (error) throw error;
  return new Set((data ?? []).map((row: any) => row.habit_id));
}

async function getCompletedHabitIdsByDate(
  client: DbClient,
  userId: string,
  fromDate: string,
  toDate: string,
  habitIds: string[]
): Promise<Map<string, Set<string>>> {
  const map = new Map<string, Set<string>>();
  if (habitIds.length === 0) return map;

  const { data, error } = await client
    .from("habit_logs")
    .select("habit_id, completed_at, value")
    .eq("user_id", userId)
    .gte("completed_at", fromDate)
    .lte("completed_at", toDate)
    .in("habit_id", habitIds);

  if (error) throw error;

  for (const row of data ?? []) {
    if (Number(row.value ?? 0) <= 0) continue;

    const dateLocal = String(row.completed_at);
    const current = map.get(dateLocal) ?? new Set<string>();
    current.add(String(row.habit_id));
    map.set(dateLocal, current);
  }

  return map;
}

function isHabitScheduledOnDate(frequencyType: string, dateLocal: string): boolean {
  const day = new Date(`${dateLocal}T00:00:00Z`).getUTCDay();

  switch (frequencyType) {
    case "daily":
      return true;
    case "weekdays":
      return day >= 1 && day <= 5;
    case "weekends":
      return day === 0 || day === 6;
    default:
      return true;
  }
}

function cutoffTimeToMinutes(cutoffTime: string): number {
  const [hourRaw, minuteRaw] = cutoffTime.split(":");
  const hours = Number(hourRaw);
  const minutes = Number(minuteRaw);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return 0;
  }

  return Math.max(0, Math.min(1439, hours * 60 + minutes));
}
