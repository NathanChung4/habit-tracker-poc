"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

interface TodayRewardUnlock {
  id: string;
  title: string;
  threshold: number;
  status: "locked" | "unlocked" | "redeemed";
  explanation: string;
}

export function TodayRewardUnlocks({ initialUnlocks }: { initialUnlocks: TodayRewardUnlock[] }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const queryKey = ["today-reward-unlocks"];
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [failedUnlockId, setFailedUnlockId] = useState<string | null>(null);

  const { data: unlocks = [] } = useQuery({
    queryKey,
    queryFn: async () => initialUnlocks,
    initialData: initialUnlocks
  });

  const redeemMutation = useMutation({
    mutationFn: async (unlockId: string) => {
      const response = await fetch(`/api/rewards/${unlockId}/redeem`, {
        method: "POST"
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Failed to redeem reward" }));
        throw new Error(payload.error ?? "Failed to redeem reward");
      }

      return { unlockId };
    },
    retry: 1,
    onSuccess: ({ unlockId }) => {
      queryClient.setQueryData<TodayRewardUnlock[]>(queryKey, (current = []) =>
        current.map((unlock) =>
          unlock.id === unlockId
            ? {
                ...unlock,
                status: "redeemed"
              }
            : unlock
        )
      );
      setRedeemError(null);
      setFailedUnlockId(null);
    },
    onError: (error, unlockId) => {
      setRedeemError(error instanceof Error ? error.message : "Failed to redeem reward");
      setFailedUnlockId(unlockId);
    },
    onSettled: () => {
      router.refresh();
    }
  });

  return (
    <section className="panel">
      <h2>Today&apos;s Reward Unlocks</h2>
      <ul className="unlock-list">
        {unlocks.map((unlock) => (
          <li key={unlock.id}>
            <div>
              <strong>{unlock.title}</strong>
              <small>Needs {Math.round(unlock.threshold * 100)}% completion</small>
              <small>{unlock.explanation}</small>
            </div>
            {unlock.status === "unlocked" ? (
              <button
                type="button"
                className="primary"
                onClick={() => {
                  setRedeemError(null);
                  setFailedUnlockId(null);
                  redeemMutation.mutate(unlock.id);
                }}
                disabled={redeemMutation.isPending}
              >
                {redeemMutation.isPending && redeemMutation.variables === unlock.id ? "Redeeming..." : "Redeem"}
              </button>
            ) : (
              <span className={`tag status-${unlock.status}`}>{unlock.status}</span>
            )}
          </li>
        ))}
        {unlocks.length === 0 ? <li className="empty">No active reward contracts yet.</li> : null}
      </ul>
      {redeemError ? (
        <div className="error-row" role="alert">
          <p className="error-text">{redeemError}</p>
          {failedUnlockId ? (
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setRedeemError(null);
                redeemMutation.mutate(failedUnlockId);
              }}
              disabled={redeemMutation.isPending}
            >
              Retry
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
