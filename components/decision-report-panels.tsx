"use client";

import { useMemo, useState } from "react";
import type { ConsistencyEventFeedItem } from "@/lib/data";
import { StatCard } from "@/components/stat-card";
import {
  buildDecisionDailySummaries,
  countEventsInLastDays,
  detectDecisionAnomalies
} from "@/lib/decision-analytics";

export function DecisionReportPanels({ events }: { events: ConsistencyEventFeedItem[] }) {
  const dailyRows = buildDecisionDailySummaries(events);
  const [tokenWindowDays, setTokenWindowDays] = useState(7);
  const [tokenUsageThreshold, setTokenUsageThreshold] = useState(2);
  const [rewardWindowDays, setRewardWindowDays] = useState(14);
  const [streakEvalWindowDays, setStreakEvalWindowDays] = useState(2);

  const tokenConsumes = countEventsInLastDays(events, "token_consumed", tokenWindowDays);
  const unlocked = countEventsInLastDays(events, "reward_unlocked", rewardWindowDays);
  const redeemed = countEventsInLastDays(events, "reward_redeemed", rewardWindowDays);
  const anomalies = useMemo(
    () =>
      detectDecisionAnomalies(events, undefined, {
        tokenWindowDays,
        tokenUsageThreshold,
        rewardWindowDays,
        streakEvalWindowDays
      }),
    [events, tokenWindowDays, tokenUsageThreshold, rewardWindowDays, streakEvalWindowDays]
  );

  return (
    <div className="page">
      <div className="stats-grid">
        <StatCard
          label={`Token uses (${tokenWindowDays}d)`}
          value={`${tokenConsumes}`}
          hint={`Token threshold set to ${tokenUsageThreshold}`}
          accent="orange"
        />
        <StatCard
          label={`Unlocked (${rewardWindowDays}d)`}
          value={`${unlocked}`}
          hint={`Rewards unlocked in the last ${rewardWindowDays} days`}
          accent="teal"
        />
        <StatCard
          label={`Redeemed (${rewardWindowDays}d)`}
          value={`${redeemed}`}
          hint={`Rewards redeemed in the last ${rewardWindowDays} days`}
          accent="blue"
        />
      </div>

      <section className="panel">
        <h2>Diagnostics Controls</h2>
        <form className="filter-row" onSubmit={(event) => event.preventDefault()}>
          <label>
            Token window (days)
            <input
              type="number"
              min={1}
              max={60}
              value={tokenWindowDays}
              onChange={(event) => setTokenWindowDays(Number(event.target.value) || 1)}
            />
          </label>
          <label>
            Token threshold
            <input
              type="number"
              min={1}
              max={20}
              value={tokenUsageThreshold}
              onChange={(event) => setTokenUsageThreshold(Number(event.target.value) || 1)}
            />
          </label>
          <label>
            Reward window (days)
            <input
              type="number"
              min={1}
              max={60}
              value={rewardWindowDays}
              onChange={(event) => setRewardWindowDays(Number(event.target.value) || 1)}
            />
          </label>
          <label>
            Streak eval window (days)
            <input
              type="number"
              min={1}
              max={30}
              value={streakEvalWindowDays}
              onChange={(event) => setStreakEvalWindowDays(Number(event.target.value) || 1)}
            />
          </label>
        </form>
      </section>

      <section className="panel">
        <h2>Anomaly Flags</h2>
        <ul className="explanation-list">
          {anomalies.map((anomaly) => (
            <li key={anomaly}>
              <p>{anomaly}</p>
            </li>
          ))}
          {anomalies.length === 0 ? <li className="empty">No anomalies in the recent decision window.</li> : null}
        </ul>
      </section>

      <section className="panel">
        <h2>Decision Timeline</h2>
        <ul className="explanation-list">
          {dailyRows.map((row) => (
            <li key={row.dateLocal}>
              <strong>{row.dateLocal}</strong>
              <small>
                total {row.total} • streak {row.counts.streak_evaluated} • token {row.counts.token_consumed} • unlock{" "}
                {row.counts.reward_unlocked} • redeem {row.counts.reward_redeemed}
              </small>
              {row.events.map((event) => (
                <p key={event.id}>{event.message}</p>
              ))}
            </li>
          ))}
          {dailyRows.length === 0 ? <li className="empty">No decision events yet.</li> : null}
        </ul>
      </section>
    </div>
  );
}
