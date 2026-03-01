"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

type ConsistencyEventType = "streak_evaluated" | "token_consumed" | "reward_unlocked" | "reward_redeemed";

interface DecisionEvent {
  id: string;
  eventType: ConsistencyEventType;
  dateLocal: string;
  createdAt: string;
  message: string;
}

interface RecentDecisionsPanelProps {
  initialEvents: DecisionEvent[];
}

export function RecentDecisionsPanel({ initialEvents }: RecentDecisionsPanelProps) {
  const [type, setType] = useState<ConsistencyEventType | "all">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ limit: "10" });
    if (type !== "all") params.set("type", type);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return params.toString();
  }, [type, from, to]);

  const { data: events = initialEvents, isFetching, error } = useQuery({
    queryKey: ["consistency-events", type, from, to],
    queryFn: async () => {
      const response = await fetch(`/api/events/consistency?${queryString}`);
      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Failed to load events" }));
        throw new Error(payload.error ?? "Failed to load events");
      }

      const payload = (await response.json()) as { events: DecisionEvent[] };
      return payload.events;
    },
    initialData: initialEvents
  });

  return (
    <section className="panel">
      <h2>Recent Decisions</h2>
      <form className="filter-row" onSubmit={(event) => event.preventDefault()}>
        <label>
          Event type
          <select value={type} onChange={(event) => setType(event.target.value as ConsistencyEventType | "all")}>
            <option value="all">All events</option>
            <option value="streak_evaluated">Streak evaluated</option>
            <option value="token_consumed">Token consumed</option>
            <option value="reward_unlocked">Reward unlocked</option>
            <option value="reward_redeemed">Reward redeemed</option>
          </select>
        </label>
        <label>
          From
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </label>
        <label>
          To
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </label>
      </form>
      {isFetching ? <p className="muted">Updating decisions…</p> : null}
      {error ? (
        <p className="error-text" role="alert">
          {error instanceof Error ? error.message : "Failed to load events"}
        </p>
      ) : null}
      <ul className="explanation-list">
        {events.map((event) => (
          <li key={event.id}>
            <strong>{event.eventType}</strong>
            <small>{event.dateLocal}</small>
            <p>{event.message}</p>
          </li>
        ))}
        {events.length === 0 ? <li className="empty">No decisions for these filters.</li> : null}
      </ul>
    </section>
  );
}
