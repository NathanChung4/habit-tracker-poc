import type { ConsistencyEventFeedItem } from "@/lib/data";
import { StatCard } from "@/components/stat-card";
import {
  buildDecisionDailySummaries,
  countEventsInLastDays,
  detectDecisionAnomalies
} from "@/lib/decision-analytics";

export function DecisionReportPanels({ events }: { events: ConsistencyEventFeedItem[] }) {
  const dailyRows = buildDecisionDailySummaries(events);
  const tokenConsumes7d = countEventsInLastDays(events, "token_consumed", 7);
  const unlocked14d = countEventsInLastDays(events, "reward_unlocked", 14);
  const redeemed14d = countEventsInLastDays(events, "reward_redeemed", 14);
  const anomalies = detectDecisionAnomalies(events);

  return (
    <div className="page">
      <div className="stats-grid">
        <StatCard
          label="Token uses (7d)"
          value={`${tokenConsumes7d}`}
          hint="Protection tokens consumed in the last 7 days"
          accent="orange"
        />
        <StatCard
          label="Unlocked (14d)"
          value={`${unlocked14d}`}
          hint="Rewards unlocked in the last 14 days"
          accent="teal"
        />
        <StatCard
          label="Redeemed (14d)"
          value={`${redeemed14d}`}
          hint="Rewards redeemed in the last 14 days"
          accent="blue"
        />
      </div>

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
