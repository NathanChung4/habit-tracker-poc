"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

interface TodayItem {
  id: string;
  title: string;
  notes: string | null;
  status: "pending" | "done" | "missed";
}

interface TodayChecklistProps {
  initialItems: TodayItem[];
}

const queryKey = ["today-instances"];

export function TodayChecklist({ initialItems }: TodayChecklistProps) {
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data: items } = useQuery({
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
    onError: (_error, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
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
              disabled={item.status === "missed" || toggleMutation.isPending}
              onClick={() => toggleMutation.mutate(item.id)}
              className={`check-item status-${item.status}`}
            >
              <span className="dot" aria-hidden />
              <span className="content">
                <strong>{item.title}</strong>
                {item.notes ? <small>{item.notes}</small> : null}
              </span>
              <span className="status-label">
                {item.status === "done" ? "Done" : item.status === "missed" ? "Missed" : "Pending"}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
