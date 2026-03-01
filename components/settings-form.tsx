"use client";

import { FormEvent, useState } from "react";

interface SettingsFormProps {
  timezone: string;
  cutoffTime: string;
  protectionTokens: number;
}

function normalizeTimeForInput(value: string): string {
  return value.length >= 5 ? value.slice(0, 5) : "04:00";
}

export function SettingsForm({ timezone, cutoffTime, protectionTokens }: SettingsFormProps) {
  const [tz, setTz] = useState(timezone);
  const [cutoff, setCutoff] = useState(normalizeTimeForInput(cutoffTime));
  const [tokens, setTokens] = useState(protectionTokens);
  const [status, setStatus] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setStatus(null);

    const response = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        timezone: tz,
        cutoffTime: `${cutoff}:00`,
        protectionTokens: tokens
      })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: "Could not update settings" }));
      setStatus(payload.error ?? "Could not update settings");
      return;
    }

    setStatus("Settings updated.");
  };

  const commonTimezones = [
    "UTC",
    "America/Chicago",
    "America/New_York",
    "America/Los_Angeles",
    "Europe/London",
    "Asia/Tokyo"
  ];

  return (
    <form className="panel stack-form" onSubmit={onSubmit}>
      <h2>Daily Consistency Settings</h2>
      <label>
        Timezone
        <select value={tz} onChange={(event) => setTz(event.target.value)}>
          {commonTimezones.map((zone) => (
            <option key={zone} value={zone}>
              {zone}
            </option>
          ))}
        </select>
      </label>
      <label>
        Daily cutoff time
        <input type="time" value={cutoff} onChange={(event) => setCutoff(event.target.value)} />
      </label>
      <label>
        Protection tokens
        <input
          type="number"
          min={0}
          max={20}
          value={tokens}
          onChange={(event) => setTokens(Number(event.target.value) || 0)}
        />
      </label>
      <button type="submit" className="primary">
        Save settings
      </button>
      <p className="muted">Streak logic is fixed at the 80% completion rule.</p>
      {status ? <p className="muted">{status}</p> : null}
    </form>
  );
}
