import type { ConsistencyEventFeedItem } from "@/lib/data";

type EventType = ConsistencyEventFeedItem["eventType"];

export interface DecisionDailySummary {
  dateLocal: string;
  total: number;
  counts: Record<EventType, number>;
  events: ConsistencyEventFeedItem[];
}

export interface DecisionAnomalyOptions {
  tokenWindowDays?: number;
  tokenUsageThreshold?: number;
  rewardWindowDays?: number;
  streakEvalWindowDays?: number;
}

const EMPTY_COUNTS: Record<EventType, number> = {
  streak_evaluated: 0,
  token_consumed: 0,
  reward_unlocked: 0,
  reward_redeemed: 0
};

export function buildDecisionDailySummaries(events: ConsistencyEventFeedItem[]): DecisionDailySummary[] {
  const map = new Map<string, DecisionDailySummary>();

  for (const event of events) {
    const current =
      map.get(event.dateLocal) ??
      ({
        dateLocal: event.dateLocal,
        total: 0,
        counts: { ...EMPTY_COUNTS },
        events: []
      } as DecisionDailySummary);

    current.total += 1;
    current.counts[event.eventType] += 1;
    current.events.push(event);
    map.set(event.dateLocal, current);
  }

  return [...map.values()].sort((a, b) => b.dateLocal.localeCompare(a.dateLocal));
}

export function countEventsInLastDays(
  events: ConsistencyEventFeedItem[],
  type: EventType,
  days: number,
  referenceDateLocal?: string
): number {
  if (days <= 0) return 0;
  const base = referenceDateLocal ?? inferReferenceDate(events);
  if (!base) return 0;
  const cutoff = shiftDateLocal(base, -(days - 1));
  return events.filter((event) => event.eventType === type && event.dateLocal >= cutoff && event.dateLocal <= base).length;
}

export function detectDecisionAnomalies(
  events: ConsistencyEventFeedItem[],
  referenceDateLocal?: string,
  options: DecisionAnomalyOptions = {}
): string[] {
  const base = referenceDateLocal ?? inferReferenceDate(events);
  if (!base) return [];

  const tokenWindowDays = sanitizeWindow(options.tokenWindowDays, 7);
  const tokenUsageThreshold = sanitizeThreshold(options.tokenUsageThreshold, 2);
  const rewardWindowDays = sanitizeWindow(options.rewardWindowDays, 14);
  const streakEvalWindowDays = sanitizeWindow(options.streakEvalWindowDays, 2);

  const tokenConsumesInWindow = countEventsInLastDays(events, "token_consumed", tokenWindowDays, base);
  const rewardsUnlockedInWindow = countEventsInLastDays(events, "reward_unlocked", rewardWindowDays, base);
  const rewardsRedeemedInWindow = countEventsInLastDays(events, "reward_redeemed", rewardWindowDays, base);
  const streakEvaluatedInWindow = countEventsInLastDays(events, "streak_evaluated", streakEvalWindowDays, base);

  const anomalies: string[] = [];

  if (tokenConsumesInWindow >= tokenUsageThreshold) {
    anomalies.push(`High token usage: ${tokenConsumesInWindow} token consumes in the last ${tokenWindowDays} days.`);
  }

  if (rewardsRedeemedInWindow > rewardsUnlockedInWindow) {
    anomalies.push(
      `Redeem/unlock mismatch: ${rewardsRedeemedInWindow} redeems vs ${rewardsUnlockedInWindow} unlocks in the last ${rewardWindowDays} days.`
    );
  }

  if (streakEvaluatedInWindow === 0) {
    anomalies.push(`No streak evaluation events in the last ${streakEvalWindowDays} days.`);
  }

  return anomalies;
}

function inferReferenceDate(events: ConsistencyEventFeedItem[]): string | null {
  if (events.length === 0) return null;
  return [...events].sort((a, b) => b.dateLocal.localeCompare(a.dateLocal))[0]?.dateLocal ?? null;
}

function shiftDateLocal(dateLocal: string, deltaDays: number): string {
  const date = new Date(`${dateLocal}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + deltaDays);
  return date.toISOString().slice(0, 10);
}

function sanitizeWindow(value: number | undefined, fallback: number): number {
  const next = Number(value);
  if (!Number.isFinite(next)) return fallback;
  return Math.max(1, Math.min(60, Math.floor(next)));
}

function sanitizeThreshold(value: number | undefined, fallback: number): number {
  const next = Number(value);
  if (!Number.isFinite(next)) return fallback;
  return Math.max(1, Math.min(20, Math.floor(next)));
}
