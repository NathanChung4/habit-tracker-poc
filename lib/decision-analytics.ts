import type { ConsistencyEventFeedItem } from "@/lib/data";

type EventType = ConsistencyEventFeedItem["eventType"];

export interface DecisionDailySummary {
  dateLocal: string;
  total: number;
  counts: Record<EventType, number>;
  events: ConsistencyEventFeedItem[];
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
  referenceDateLocal?: string
): string[] {
  const base = referenceDateLocal ?? inferReferenceDate(events);
  if (!base) return [];

  const tokenConsumesLast7 = countEventsInLastDays(events, "token_consumed", 7, base);
  const rewardsUnlockedLast14 = countEventsInLastDays(events, "reward_unlocked", 14, base);
  const rewardsRedeemedLast14 = countEventsInLastDays(events, "reward_redeemed", 14, base);
  const streakEvaluatedLast2 = countEventsInLastDays(events, "streak_evaluated", 2, base);

  const anomalies: string[] = [];

  if (tokenConsumesLast7 >= 2) {
    anomalies.push(`High token usage: ${tokenConsumesLast7} token consumes in the last 7 days.`);
  }

  if (rewardsRedeemedLast14 > rewardsUnlockedLast14) {
    anomalies.push(
      `Redeem/unlock mismatch: ${rewardsRedeemedLast14} redeems vs ${rewardsUnlockedLast14} unlocks in the last 14 days.`
    );
  }

  if (streakEvaluatedLast2 === 0) {
    anomalies.push("No streak evaluation events in the last 2 days.");
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
