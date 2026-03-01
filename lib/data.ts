import type { SupabaseClient } from "@supabase/supabase-js";
import { expandDatesBetween, getEffectiveLocalDate, getWeekStartDate, shiftDateLocal } from "@patternfinder/domain";
import {
  decisionDiagnosticsSettingsPatchSchema,
  decisionDiagnosticsSettingsSchema,
  habitSchema,
  profileSettingsSchema,
  rewardContractCreateSchema,
  rewardContractPatchSchema
} from "@/lib/validators";

type DbClient = SupabaseClient<any, "public", any>;

const STREAK_THRESHOLD = 0.8;
const DEFAULT_REPORT_DAYS = 14;
const DEFAULT_DECISION_DIAGNOSTICS_SETTINGS = {
  tokenWindowDays: 7,
  tokenUsageThreshold: 2,
  rewardWindowDays: 14,
  streakEvalWindowDays: 2
} as const;

export interface ProfileRow {
  id: string;
  timezone: string;
  cutoff_time: string;
  protection_tokens: number;
}

export interface DecisionDiagnosticsSettings {
  tokenWindowDays: number;
  tokenUsageThreshold: number;
  rewardWindowDays: number;
  streakEvalWindowDays: number;
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
  explanation: string;
}

export interface RewardHistoryRow {
  id: string;
  reward_contract_id: string;
  title: string;
  date_local: string;
  redeemed_at: string | null;
}

type ConsistencyEventType = "streak_evaluated" | "token_consumed" | "reward_unlocked" | "reward_redeemed";

interface ConsistencyEventRow {
  id: string;
  event_type: ConsistencyEventType;
  date_local: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface ConsistencyEventFeedItem {
  id: string;
  eventType: ConsistencyEventType;
  dateLocal: string;
  createdAt: string;
  message: string;
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
  recentEvents: ConsistencyEventFeedItem[];
  summary: {
    completionRate: number;
    scheduledCount: number;
    completedCount: number;
    streakCount: number;
    tokenUsed: boolean;
    streakExplanation: string;
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

interface DailyCountRowInput {
  date_local: string;
  scheduled_count: number;
  completed_count: number;
}

export function getEffectiveDateForProfile(
  now: Date,
  profile: Pick<ProfileRow, "timezone" | "cutoff_time">
): string {
  return getEffectiveLocalDate(now, profile.timezone, cutoffTimeToMinutes(profile.cutoff_time));
}

export function applyStreakAndTokenPolicy(
  rows: DailyCountRowInput[],
  options: {
    protectionTokens: number;
    todayLocal: string;
    threshold?: number;
  }
): DailyConsistencyRow[] {
  let streakCount = 0;
  let tokensRemaining = Math.max(0, options.protectionTokens);
  const threshold = options.threshold ?? STREAK_THRESHOLD;

  return rows.map((row) => {
    const completionRate = row.scheduled_count > 0 ? row.completed_count / row.scheduled_count : 0;
    let tokenUsed = false;

    if (row.scheduled_count > 0) {
      if (completionRate >= threshold) {
        streakCount += 1;
      } else if (row.date_local === options.todayLocal) {
        // Do not consume a token on an open day.
      } else if (tokensRemaining > 0) {
        tokensRemaining -= 1;
        tokenUsed = true;
        streakCount += 1;
      } else {
        streakCount = 0;
      }
    }

    return {
      date_local: row.date_local,
      completion_rate: completionRate,
      scheduled_count: row.scheduled_count,
      completed_count: row.completed_count,
      streak_count: streakCount,
      token_used: tokenUsed
    };
  });
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

export async function getDecisionDiagnosticsSettings(
  client: DbClient,
  userId: string
): Promise<DecisionDiagnosticsSettings> {
  const { data, error } = await client
    .from("decision_diagnostics_settings")
    .select("user_id, token_window_days, token_usage_threshold, reward_window_days, streak_eval_window_days")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (String((error as any).code ?? "") === "42P01") {
      return { ...DEFAULT_DECISION_DIAGNOSTICS_SETTINGS };
    }
    throw error;
  }

  if (data) {
    return mapDecisionDiagnosticsSettingsRow(data);
  }

  const { data: created, error: insertError } = await client
    .from("decision_diagnostics_settings")
    .insert({ user_id: userId })
    .select("user_id, token_window_days, token_usage_threshold, reward_window_days, streak_eval_window_days")
    .single();

  if (insertError) {
    if (String((insertError as any).code ?? "") === "42P01") {
      return { ...DEFAULT_DECISION_DIAGNOSTICS_SETTINGS };
    }
    throw insertError;
  }

  return mapDecisionDiagnosticsSettingsRow(created);
}

export async function updateDecisionDiagnosticsSettings(
  client: DbClient,
  userId: string,
  payload: unknown
): Promise<DecisionDiagnosticsSettings> {
  const parsed = decisionDiagnosticsSettingsPatchSchema.parse(payload);
  const updatePayload: Record<string, number> = {};

  if (parsed.tokenWindowDays !== undefined) updatePayload.token_window_days = parsed.tokenWindowDays;
  if (parsed.tokenUsageThreshold !== undefined) updatePayload.token_usage_threshold = parsed.tokenUsageThreshold;
  if (parsed.rewardWindowDays !== undefined) updatePayload.reward_window_days = parsed.rewardWindowDays;
  if (parsed.streakEvalWindowDays !== undefined) updatePayload.streak_eval_window_days = parsed.streakEvalWindowDays;

  const { data, error } = await client
    .from("decision_diagnostics_settings")
    .upsert(
      {
        user_id: userId,
        ...updatePayload
      },
      { onConflict: "user_id" }
    )
    .select("user_id, token_window_days, token_usage_threshold, reward_window_days, streak_eval_window_days")
    .single();

  if (error) {
    if (String((error as any).code ?? "") === "42P01") {
      throw new Error("Decision diagnostics settings table is unavailable. Apply the latest migrations.");
    }
    throw error;
  }

  return mapDecisionDiagnosticsSettingsRow(data);
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
  const dateLocal = getEffectiveDateForProfile(new Date(), profile);
  const habits = await listHabits(client, userId);
  const completion = await computeCompletionForDate(client, userId, habits, dateLocal);
  const activeRewardContracts = (await listRewardContracts(client, userId)).filter((contract) => contract.is_active);
  await refreshRewardUnlocksForDate(client, userId, dateLocal, completion.completionRate, activeRewardContracts);
  const [rewardUnlocks, rewardHistory] = await Promise.all([
    listRewardUnlocksForDate(client, userId, dateLocal, activeRewardContracts, completion.completionRate),
    listRecentRewardHistory(client, userId, 7)
  ]);
  const weeklyRedeemedCount = await getWeeklyRedeemedCount(client, userId, dateLocal);

  const streakState = await computeCurrentStreak(client, userId, profile, habits, dateLocal);
  const streakExplanation = buildStreakExplanation({
    completionRate: completion.completionRate,
    scheduledCount: completion.scheduledCount,
    threshold: STREAK_THRESHOLD,
    tokenUsed: streakState.tokenUsed,
    protectionTokens: profile.protection_tokens
  });
  await recordConsistencyEvent(client, userId, {
    eventType: "streak_evaluated",
    dateLocal,
    eventKey: `streak_evaluated:${dateLocal}`,
    payload: {
      completionRate: completion.completionRate,
      scheduledCount: completion.scheduledCount,
      completedCount: completion.completedCount,
      threshold: STREAK_THRESHOLD,
      streakCount: streakState.streakCount,
      tokenUsed: streakState.tokenUsed
    }
  });
  if (streakState.tokenUsed) {
    await recordConsistencyEvent(client, userId, {
      eventType: "token_consumed",
      dateLocal,
      eventKey: `token_consumed:${dateLocal}`,
      payload: {
        streakCount: streakState.streakCount,
        protectionTokens: profile.protection_tokens
      }
    });
  }
  const recentEvents = await listRecentConsistencyEvents(client, userId, { limit: 10 });

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
    recentEvents,
    summary: {
      completionRate: completion.completionRate,
      scheduledCount: completion.scheduledCount,
      completedCount: completion.completedCount,
      streakCount: streakState.streakCount,
      tokenUsed: streakState.tokenUsed,
      streakExplanation,
      threshold: STREAK_THRESHOLD,
      weeklyRedeemedCount
    }
  };
}

export async function toggleDayInstance(client: DbClient, userId: string, habitId: string) {
  const profile = await ensureProfile(client, userId);
  const dateLocal = getEffectiveDateForProfile(new Date(), profile);

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

  const todayLocal = getEffectiveDateForProfile(new Date(), profile);
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
  const todayLocal = getEffectiveDateForProfile(new Date(), profile);
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

  if (error) throw error;
  return (data ?? []).map(mapRewardContractRow);
}

export async function createRewardContract(client: DbClient, userId: string, payload: unknown): Promise<RewardContractRow> {
  const parsed = rewardContractCreateSchema.parse(payload);

  const { data, error } = await client
    .from("reward_contracts")
    .insert({
      user_id: userId,
      title: parsed.title,
      rule_type: "completion_threshold",
      threshold: parsed.threshold,
      is_active: parsed.isActive
    })
    .select("id, user_id, title, rule_type, threshold, is_active, created_at")
    .single();

  if (error) throw error;
  return mapRewardContractRow(data);
}

export async function updateRewardContract(
  client: DbClient,
  userId: string,
  contractId: string,
  payload: unknown
): Promise<RewardContractRow> {
  const parsed = rewardContractPatchSchema.parse(payload);
  const updatePayload: Record<string, unknown> = {};

  if (parsed.title !== undefined) updatePayload.title = parsed.title;
  if (parsed.threshold !== undefined) updatePayload.threshold = parsed.threshold;
  if (parsed.isActive !== undefined) updatePayload.is_active = parsed.isActive;

  const { data, error } = await client
    .from("reward_contracts")
    .update(updatePayload)
    .eq("id", contractId)
    .eq("user_id", userId)
    .select("id, user_id, title, rule_type, threshold, is_active, created_at")
    .single();

  if (error) throw error;
  return mapRewardContractRow(data);
}

export async function deleteRewardContract(client: DbClient, userId: string, contractId: string): Promise<void> {
  const { error } = await client.from("reward_contracts").delete().eq("id", contractId).eq("user_id", userId);
  if (error) throw error;
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
    .select("id, reward_contract_id, date_local, status, redeemed_at")
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

  await recordConsistencyEvent(client, userId, {
    eventType: "reward_redeemed",
    dateLocal: String((result.data as any).date_local),
    eventKey: `reward_redeemed:${unlockId}`,
    payload: {
      unlockId,
      rewardContractId: String((result.data as any).reward_contract_id)
    }
  });

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
  const newlyUnlockedContracts = activeContracts.filter((contract) => {
    const existingStatus = existingStatusByContract.get(contract.id);
    const computedStatus = completionRate >= contract.threshold ? "unlocked" : "locked";
    return existingStatus !== "redeemed" && computedStatus === "unlocked" && existingStatus !== "unlocked";
  });

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

  await Promise.all(
    newlyUnlockedContracts.map((contract) =>
      recordConsistencyEvent(client, userId, {
        eventType: "reward_unlocked",
        dateLocal,
        eventKey: `reward_unlocked:${contract.id}:${dateLocal}`,
        payload: {
          rewardContractId: contract.id,
          title: contract.title,
          threshold: contract.threshold,
          completionRate
        }
      })
    )
  );
}

async function listRewardUnlocksForDate(
  client: DbClient,
  userId: string,
  dateLocal: string,
  activeContracts: RewardContractRow[],
  completionRate: number
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
        status: "locked",
        explanation: buildRewardStatusExplanation("locked", completionRate, contract.threshold)
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
      status: normalizedStatus,
      explanation: buildRewardStatusExplanation(normalizedStatus, completionRate, contract.threshold)
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

export async function getConsistencyEvents(
  client: DbClient,
  userId: string,
  options: {
    limit?: number;
    type?: ConsistencyEventType;
    from?: string;
    to?: string;
  } = {}
): Promise<ConsistencyEventFeedItem[]> {
  return listRecentConsistencyEvents(client, userId, options);
}

async function listRecentConsistencyEvents(
  client: DbClient,
  userId: string,
  options: {
    limit?: number;
    type?: ConsistencyEventType;
    from?: string;
    to?: string;
  }
): Promise<ConsistencyEventFeedItem[]> {
  const safeLimit = Math.max(1, Math.min(options.limit ?? 20, 50));
  let query = client
    .from("consistency_events")
    .select("id, event_type, date_local, payload, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (options.type) {
    query = query.eq("event_type", options.type);
  }

  if (options.from) {
    query = query.gte("date_local", options.from);
  }

  if (options.to) {
    query = query.lte("date_local", options.to);
  }

  const result = await query.limit(safeLimit);

  if (result.error) {
    if (String((result.error as any).code ?? "") === "42P01") {
      return [];
    }
    throw result.error;
  }

  return (result.data ?? []).map((row: any) => {
    const event: ConsistencyEventRow = {
      id: String(row.id),
      event_type: String(row.event_type) as ConsistencyEventType,
      date_local: String(row.date_local),
      payload: (row.payload ?? {}) as Record<string, unknown>,
      created_at: String(row.created_at)
    };

    return {
      id: event.id,
      eventType: event.event_type,
      dateLocal: event.date_local,
      createdAt: event.created_at,
      message: summarizeConsistencyEvent(event)
    };
  });
}

async function recordConsistencyEvent(
  client: DbClient,
  userId: string,
  input: {
    eventType: ConsistencyEventType;
    eventKey: string;
    dateLocal: string;
    payload: Record<string, unknown>;
  }
): Promise<void> {
  const result = await client.from("consistency_events").upsert(
    {
      user_id: userId,
      date_local: input.dateLocal,
      event_type: input.eventType,
      event_key: input.eventKey,
      payload: input.payload
    },
    { onConflict: "user_id,event_key", ignoreDuplicates: true }
  );

  if (result.error && String((result.error as any).code ?? "") !== "42P01") {
    throw result.error;
  }
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
  const countRows: DailyCountRowInput[] = [];

  for (const dateLocal of dates) {
    const scheduledHabits = habits.filter((habit) => isHabitScheduledOnDate(habit.frequency_type, dateLocal));
    const scheduledCount = scheduledHabits.length;
    const completedSet = logsByDate.get(dateLocal) ?? new Set<string>();
    const completedCount = scheduledHabits.filter((habit) => completedSet.has(habit.id)).length;
    countRows.push({
      date_local: dateLocal,
      scheduled_count: scheduledCount,
      completed_count: completedCount
    });
  }

  return applyStreakAndTokenPolicy(countRows, { protectionTokens, todayLocal, threshold: STREAK_THRESHOLD });
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

function mapRewardContractRow(row: any): RewardContractRow {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    title: String(row.title),
    rule_type: String(row.rule_type ?? "completion_threshold"),
    threshold: Number(row.threshold ?? 1),
    is_active: Boolean(row.is_active),
    created_at: String(row.created_at)
  };
}

function mapDecisionDiagnosticsSettingsRow(row: any): DecisionDiagnosticsSettings {
  const parsed = decisionDiagnosticsSettingsSchema.safeParse({
    tokenWindowDays: Number(row.token_window_days),
    tokenUsageThreshold: Number(row.token_usage_threshold),
    rewardWindowDays: Number(row.reward_window_days),
    streakEvalWindowDays: Number(row.streak_eval_window_days)
  });

  if (parsed.success) {
    return parsed.data;
  }

  return { ...DEFAULT_DECISION_DIAGNOSTICS_SETTINGS };
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

function buildRewardStatusExplanation(
  status: "locked" | "unlocked" | "redeemed",
  completionRate: number,
  threshold: number
): string {
  const completionPercent = Math.round(completionRate * 100);
  const thresholdPercent = Math.round(threshold * 100);

  if (status === "redeemed") {
    return `Redeemed after today reached ${completionPercent}% (threshold ${thresholdPercent}%).`;
  }

  if (status === "unlocked") {
    return `Unlocked because today is ${completionPercent}% and meets the ${thresholdPercent}% threshold.`;
  }

  return `Locked because today is ${completionPercent}%, below the ${thresholdPercent}% threshold.`;
}

function buildStreakExplanation(input: {
  completionRate: number;
  scheduledCount: number;
  threshold: number;
  tokenUsed: boolean;
  protectionTokens: number;
}): string {
  if (input.scheduledCount === 0) {
    return "No habits were scheduled today, so the streak is unchanged.";
  }

  const completionPercent = Math.round(input.completionRate * 100);
  const thresholdPercent = Math.round(input.threshold * 100);

  if (input.completionRate >= input.threshold) {
    return `Streak advances because today hit ${completionPercent}%, meeting the ${thresholdPercent}% rule.`;
  }

  if (input.tokenUsed) {
    return "A protection token was consumed to preserve this streak.";
  }

  if (input.protectionTokens > 0) {
    return `Today is ${completionPercent}%, below ${thresholdPercent}%. A protection token can preserve the streak at rollover.`;
  }

  return `Today is ${completionPercent}%, below ${thresholdPercent}%, and no protection tokens remain.`;
}

function summarizeConsistencyEvent(event: ConsistencyEventRow): string {
  switch (event.event_type) {
    case "streak_evaluated": {
      const completionPercent = Math.round(Number(event.payload.completionRate ?? 0) * 100);
      const streakCount = Number(event.payload.streakCount ?? 0);
      return `Streak evaluated at ${completionPercent}% completion (current streak: ${streakCount} days).`;
    }
    case "token_consumed":
      return "A protection token was consumed to preserve the streak.";
    case "reward_unlocked": {
      const title = String(event.payload.title ?? "Reward");
      return `${title} was unlocked for this day.`;
    }
    case "reward_redeemed":
      return "A reward unlock was redeemed.";
    default:
      return "Consistency event recorded.";
  }
}
