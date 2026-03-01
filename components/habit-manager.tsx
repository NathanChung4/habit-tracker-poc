"use client";

import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

interface HabitItem {
  id: string;
  name: string;
  description: string | null;
  frequency_type: "daily" | "weekdays" | "weekends";
  target_threshold: number;
}

const frequencyLabels: Record<HabitItem["frequency_type"], string> = {
  daily: "Every day",
  weekdays: "Weekdays (Mon-Fri)",
  weekends: "Weekends (Sat-Sun)"
};

export function HabitManager({ initialHabits }: { initialHabits: HabitItem[] }) {
  const queryClient = useQueryClient();
  const queryKey = ["habits"];

  const { data: habits = [] } = useQuery({
    queryKey,
    queryFn: async () => initialHabits,
    initialData: initialHabits
  });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [frequencyType, setFrequencyType] = useState<HabitItem["frequency_type"]>("daily");
  const [targetThreshold, setTargetThreshold] = useState(0.8);

  const createMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/habits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description.trim() ? description.trim() : null,
          frequencyType,
          targetThreshold
        })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Failed to create habit" }));
        throw new Error(payload.error ?? "Failed to create habit");
      }

      return response.json();
    },
    onSuccess: (result) => {
      queryClient.setQueryData<HabitItem[]>(queryKey, (current = []) => [...current, result.habit]);
      setName("");
      setDescription("");
      setFrequencyType("daily");
      setTargetThreshold(0.8);
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

  const schedulePreview = useMemo(() => frequencyLabels[frequencyType], [frequencyType]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    await createMutation.mutateAsync();
  };

  return (
    <div className="habit-layout">
      <section className="panel">
        <h2>Create Habit</h2>
        <form onSubmit={onSubmit} className="stack-form">
          <label>
            Habit name
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Go to the gym" required />
          </label>
          <label>
            Description
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Optional context for this habit"
            />
          </label>
          <label>
            Frequency
            <select
              value={frequencyType}
              onChange={(event) => setFrequencyType(event.target.value as HabitItem["frequency_type"])}
            >
              <option value="daily">Daily</option>
              <option value="weekdays">Weekdays</option>
              <option value="weekends">Weekends</option>
            </select>
          </label>
          <label>
            Target threshold
            <input
              type="number"
              min={0}
              max={1}
              step="0.05"
              value={targetThreshold}
              onChange={(event) => setTargetThreshold(Number(event.target.value) || 0.8)}
            />
          </label>

          <p className="muted">{schedulePreview}</p>
          <button type="submit" className="primary" disabled={createMutation.isPending || !name.trim()}>
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
                <strong>{habit.name}</strong>
                {habit.description ? <p>{habit.description}</p> : null}
                <small>
                  {frequencyLabels[habit.frequency_type]} • {Math.round(habit.target_threshold * 100)}% target
                </small>
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
