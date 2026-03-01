"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

interface TodayItem {
  id: string;
  name: string;
  description: string | null;
  status: "pending" | "done";
}

interface TodayChecklistProps {
  initialItems: TodayItem[];
}

const queryKey = ["today-habits"];

export function TodayChecklist({ initialItems }: TodayChecklistProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [failedHabitId, setFailedHabitId] = useState<string | null>(null);

  const { data: items = [] } = useQuery({
    queryKey,
    queryFn: async () => initialItems,
    initialData: initialItems
  });

  const toggleMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/day-instances/${id}/toggle`, {
        method: "POST"
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Failed to toggle habit" }));
        throw new Error(payload.error ?? "Failed to toggle habit");
      }

      return response.json();
    },
    retry: 1,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<TodayItem[]>(queryKey) ?? [];

      queryClient.setQueryData<TodayItem[]>(queryKey, (current = []) =>
        current.map((item) => {
          if (item.id !== id) {
            return item;
          }

          return {
            ...item,
            status: item.status === "done" ? "pending" : "done"
          };
        })
      );

      return { previous };
    },
    onSuccess: () => {
      setToggleError(null);
      setFailedHabitId(null);
    },
    onError: (error, id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      setToggleError(error instanceof Error ? error.message : "Failed to toggle habit");
      setFailedHabitId(id);
    },
    onSettled: () => {
      router.refresh();
    }
  });

  return (
    <section className="panel checklist-panel">
      <header>
        <h2>Today&apos;s Checklist</h2>
        <span>{items.filter((item) => item.status === "done").length} completed</span>
      </header>
      <ul className="checklist">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              disabled={toggleMutation.isPending}
              onClick={() => {
                setToggleError(null);
                setFailedHabitId(null);
                toggleMutation.mutate(item.id);
              }}
              className={`check-item status-${item.status}`}
            >
              <span className="dot" aria-hidden />
              <span className="content">
                <strong>{item.name}</strong>
                {item.description ? <small>{item.description}</small> : null}
              </span>
              <span className="status-label">{item.status === "done" ? "Done" : "Pending"}</span>
            </button>
          </li>
        ))}
        {items.length === 0 ? <li className="empty">No habits scheduled for today.</li> : null}
      </ul>
      {toggleError ? (
        <div className="error-row" role="alert">
          <p className="error-text">{toggleError}</p>
          {failedHabitId ? (
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setToggleError(null);
                toggleMutation.mutate(failedHabitId);
              }}
              disabled={toggleMutation.isPending}
            >
              Retry
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
