"use client";

import { FormEvent, useState } from "react";

interface SettingsFormProps {
  timezone: string;
  dayCutoffMinutes: number;
  streakThreshold: number;
}

function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const mins = (minutes % 60).toString().padStart(2, "0");
  return `${hours}:${mins}`;
}

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function SettingsForm({ timezone, dayCutoffMinutes, streakThreshold }: SettingsFormProps) {
  const [tz, setTz] = useState(timezone);
  const [cutoff, setCutoff] = useState(minutesToTime(dayCutoffMinutes));
  const [threshold, setThreshold] = useState(streakThreshold);
  const [status, setStatus] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setStatus(null);

    const response = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        timezone: tz,
        dayCutoffMinutes: timeToMinutes(cutoff),
        streakThreshold: threshold
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
        Streak threshold
        <input
          type="number"
          step="0.05"
          min={0}
          max={1}
          value={threshold}
          onChange={(event) => setThreshold(Number(event.target.value))}
        />
      </label>
      <button type="submit" className="primary">
        Save settings
      </button>
      {status ? <p className="muted">{status}</p> : null}
    </form>
  );
}
