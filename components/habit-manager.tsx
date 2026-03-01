"use client";

import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

interface HabitItem {
  id: string;
  title: string;
  notes: string | null;
  schedule_type: "daily" | "weekdays" | "custom_days" | "times_per_week";
  schedule_config: {
    daysOfWeek?: number[];
    timesPerWeek?: number;
    preferredDays?: number[];
  };
}

const weekdays = [
  { label: "Sun", value: 0 },
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 }
];

export function HabitManager({ initialHabits }: { initialHabits: HabitItem[] }) {
  const queryClient = useQueryClient();
  const queryKey = ["habits"];

  const { data: habits } = useQuery({
    queryKey,
    queryFn: async () => initialHabits,
    initialData: initialHabits
  });

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [scheduleType, setScheduleType] = useState<HabitItem["schedule_type"]>("daily");
  const [customDays, setCustomDays] = useState<number[]>([1, 3, 5]);
  const [timesPerWeek, setTimesPerWeek] = useState(3);

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title,
        notes: notes.trim() ? notes.trim() : null,
        scheduleType,
        scheduleConfig:
          scheduleType === "custom_days"
            ? { daysOfWeek: customDays }
            : scheduleType === "times_per_week"
              ? { timesPerWeek, preferredDays: [1, 2, 3, 4, 5, 6, 0] }
              : {}
      };

      const response = await fetch("/api/habits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Failed to create habit" }));
        throw new Error(payload.error ?? "Failed to create habit");
      }

      return response.json();
    },
    onSuccess: (result) => {
      queryClient.setQueryData<HabitItem[]>(queryKey, (current = []) => [...current, result.habit]);
      setTitle("");
      setNotes("");
      setScheduleType("daily");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/habits/${id}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Failed to delete habit" }));
        throw new Error(payload.error ?? "Failed to delete habit");
      }

      return { id };
    },
    onSuccess: ({ id }) => {
      queryClient.setQueryData<HabitItem[]>(queryKey, (current = []) => current.filter((habit) => habit.id !== id));
    }
  });

  const schedulePreview = useMemo(() => {
    if (scheduleType === "daily") return "Every day";
    if (scheduleType === "weekdays") return "Weekdays (Mon-Fri)";
    if (scheduleType === "custom_days") {
      return `Custom days: ${customDays
        .sort((a, b) => a - b)
        .map((value) => weekdays.find((day) => day.value === value)?.label ?? value)
        .join(", ")}`;
    }
    return `${timesPerWeek}x weekly`;
  }, [customDays, scheduleType, timesPerWeek]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    await createMutation.mutateAsync();
  };

  return (
    <div className="habit-layout">
      <section className="panel">
        <h2>Create Habit</h2>
        <form onSubmit={onSubmit} className="stack-form">
          <label>
            Habit name
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Go to the gym" required />
          </label>
          <label>
            Notes
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional habit notes" />
          </label>
          <label>
            Frequency
            <select
              value={scheduleType}
              onChange={(event) => setScheduleType(event.target.value as HabitItem["schedule_type"])}
            >
              <option value="daily">Daily</option>
              <option value="weekdays">Weekdays</option>
              <option value="custom_days">Custom days</option>
              <option value="times_per_week">Times per week</option>
            </select>
          </label>

          {scheduleType === "custom_days" ? (
            <fieldset>
              <legend>Choose days</legend>
              <div className="pill-grid">
                {weekdays.map((day) => {
                  const active = customDays.includes(day.value);
                  return (
                    <button
                      key={day.value}
                      type="button"
                      className={active ? "pill active" : "pill"}
                      onClick={() => {
                        setCustomDays((current) => {
                          if (current.includes(day.value)) {
                            return current.filter((value) => value !== day.value);
                          }

                          return [...current, day.value];
                        });
                      }}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ) : null}

          {scheduleType === "times_per_week" ? (
            <label>
              Times per week
              <input
                type="number"
                min={1}
                max={7}
                value={timesPerWeek}
                onChange={(event) => setTimesPerWeek(Number(event.target.value) || 1)}
              />
            </label>
          ) : null}

          <p className="muted">{schedulePreview}</p>
          <button type="submit" className="primary" disabled={createMutation.isPending || !title.trim()}>
            Add habit
          </button>
        </form>
      </section>

      <section className="panel">
        <h2>Your Habits</h2>
        <ul className="habit-list">
          {habits.map((habit) => (
            <li key={habit.id}>
              <div>
                <strong>{habit.title}</strong>
                {habit.notes ? <p>{habit.notes}</p> : null}
                <small>{habit.schedule_type.replaceAll("_", " ")}</small>
              </div>
              <button
                type="button"
                className="ghost"
                onClick={() => deleteMutation.mutate(habit.id)}
                disabled={deleteMutation.isPending}
              >
                Delete
              </button>
            </li>
          ))}
          {habits.length === 0 ? <li className="empty">No habits yet.</li> : null}
        </ul>
      </section>
    </div>
  );
}
