"use client";

import { FormEvent, useMemo, useState } from "react";
import type { ConsistencyEventFeedItem, DecisionDiagnosticsSettings } from "@/lib/data";
import { StatCard } from "@/components/stat-card";
import {
  buildDecisionDailySummaries,
  countEventsInLastDays,
  detectDecisionAnomalies
} from "@/lib/decision-analytics";

const DEFAULT_SETTINGS: DecisionDiagnosticsSettings = {
  tokenWindowDays: 7,
  tokenUsageThreshold: 2,
  rewardWindowDays: 14,
  streakEvalWindowDays: 2
};

interface DecisionReportPanelsProps {
  events: ConsistencyEventFeedItem[];
  initialSettings: DecisionDiagnosticsSettings;
}

function parseNumericInput(rawValue: string, fallback: number, min: number, max: number) {
  const value = Number(rawValue);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

export function DecisionReportPanels({ events, initialSettings }: DecisionReportPanelsProps) {
  const dailyRows = buildDecisionDailySummaries(events);
  const [tokenWindowDays, setTokenWindowDays] = useState(initialSettings.tokenWindowDays);
  const [tokenUsageThreshold, setTokenUsageThreshold] = useState(initialSettings.tokenUsageThreshold);
  const [rewardWindowDays, setRewardWindowDays] = useState(initialSettings.rewardWindowDays);
  const [streakEvalWindowDays, setStreakEvalWindowDays] = useState(initialSettings.streakEvalWindowDays);
  const [status, setStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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

  const onSaveSettings = async (event: FormEvent) => {
    event.preventDefault();
    setStatus(null);
    setIsSaving(true);

    const response = await fetch("/api/reports/decision-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tokenWindowDays,
        tokenUsageThreshold,
        rewardWindowDays,
        streakEvalWindowDays
      })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: "Could not save diagnostics settings." }));
      setStatus(payload.error ?? "Could not save diagnostics settings.");
      setIsSaving(false);
      return;
    }

    const payload = (await response.json()) as { settings: DecisionDiagnosticsSettings };
    setTokenWindowDays(payload.settings.tokenWindowDays);
    setTokenUsageThreshold(payload.settings.tokenUsageThreshold);
    setRewardWindowDays(payload.settings.rewardWindowDays);
    setStreakEvalWindowDays(payload.settings.streakEvalWindowDays);
    setStatus("Diagnostics settings saved.");
    setIsSaving(false);
  };

  const onResetDefaults = () => {
    setTokenWindowDays(DEFAULT_SETTINGS.tokenWindowDays);
    setTokenUsageThreshold(DEFAULT_SETTINGS.tokenUsageThreshold);
    setRewardWindowDays(DEFAULT_SETTINGS.rewardWindowDays);
    setStreakEvalWindowDays(DEFAULT_SETTINGS.streakEvalWindowDays);
    setStatus("Defaults restored locally. Save to persist.");
  };

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
        <form className="stack-form" onSubmit={onSaveSettings}>
          <div className="filter-row">
            <label>
              Token window (days)
              <input
                type="number"
                min={1}
                max={60}
                value={tokenWindowDays}
                onChange={(event) => setTokenWindowDays(parseNumericInput(event.target.value, tokenWindowDays, 1, 60))}
              />
            </label>
            <label>
              Token threshold
              <input
                type="number"
                min={1}
                max={20}
                value={tokenUsageThreshold}
                onChange={(event) =>
                  setTokenUsageThreshold(parseNumericInput(event.target.value, tokenUsageThreshold, 1, 20))
                }
              />
            </label>
            <label>
              Reward window (days)
              <input
                type="number"
                min={1}
                max={60}
                value={rewardWindowDays}
                onChange={(event) =>
                  setRewardWindowDays(parseNumericInput(event.target.value, rewardWindowDays, 1, 60))
                }
              />
            </label>
            <label>
              Streak eval window (days)
              <input
                type="number"
                min={1}
                max={30}
                value={streakEvalWindowDays}
                onChange={(event) =>
                  setStreakEvalWindowDays(parseNumericInput(event.target.value, streakEvalWindowDays, 1, 30))
                }
              />
            </label>
          </div>
          <div className="form-actions">
            <button type="submit" className="primary" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save diagnostics settings"}
            </button>
            <button type="button" className="ghost" onClick={onResetDefaults} disabled={isSaving}>
              Reset to defaults
            </button>
          </div>
        </form>
        {status ? <p className="muted">{status}</p> : null}
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
