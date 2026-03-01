"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

interface RewardContract {
  id: string;
  title: string;
  rule_config: {
    threshold: number;
  };
  is_active: boolean;
}

interface RewardUnlock {
  id: string;
  reward_contract_id: string;
  contract_title: string;
  date_local: string;
  status: "locked" | "unlocked" | "redeemed";
}

interface RewardManagerProps {
  initialContracts: RewardContract[];
  initialUnlocks: RewardUnlock[];
}

export function RewardManager({ initialContracts, initialUnlocks }: RewardManagerProps) {
  const queryClient = useQueryClient();
  const contractsKey = ["reward-contracts"];
  const unlocksKey = ["reward-unlocks"];

  const { data: contracts } = useQuery({
    queryKey: contractsKey,
    queryFn: async () => initialContracts,
    initialData: initialContracts
  });

  const { data: unlocks } = useQuery({
    queryKey: unlocksKey,
    queryFn: async () => initialUnlocks,
    initialData: initialUnlocks
  });

  const [title, setTitle] = useState("");
  const [threshold, setThreshold] = useState(1);

  const createContract = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/rewards/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, threshold })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Could not create contract" }));
        throw new Error(payload.error ?? "Could not create contract");
      }

      return response.json();
    },
    onSuccess: (result) => {
      queryClient.setQueryData<RewardContract[]>(contractsKey, (current = []) => [...current, result.contract]);
      setTitle("");
      setThreshold(1);
    }
  });

  const redeemUnlock = useMutation({
    mutationFn: async (unlockId: string) => {
      const response = await fetch(`/api/rewards/${unlockId}/redeem`, {
        method: "POST"
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Could not redeem reward" }));
        throw new Error(payload.error ?? "Could not redeem reward");
      }

      return { unlockId };
    },
    onSuccess: ({ unlockId }) => {
      queryClient.setQueryData<RewardUnlock[]>(unlocksKey, (current = []) =>
        current.map((unlock) => (unlock.id === unlockId ? { ...unlock, status: "redeemed" } : unlock))
      );
    }
  });

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    await createContract.mutateAsync();
  };

  return (
    <div className="reward-layout">
      <section className="panel">
        <h2>Reward Contracts</h2>
        <form onSubmit={handleSubmit} className="stack-form">
          <label>
            Reward title
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="TikTok 30 min"
              required
            />
          </label>
          <label>
            Unlock threshold
            <input
              type="number"
              step="0.05"
              min={0}
              max={1}
              value={threshold}
              onChange={(event) => setThreshold(Number(event.target.value) || 0)}
            />
          </label>
          <button type="submit" className="primary" disabled={createContract.isPending || !title.trim()}>
            Create contract
          </button>
        </form>

        <ul className="contract-list">
          {contracts.map((contract) => (
            <li key={contract.id}>
              <strong>{contract.title}</strong>
              <small>Unlock at {Math.round(contract.rule_config.threshold * 100)}% daily completion</small>
            </li>
          ))}
          {contracts.length === 0 ? <li className="empty">No reward contracts yet.</li> : null}
        </ul>
      </section>

      <section className="panel">
        <h2>Unlock History</h2>
        <p className="muted">Rewards are honor-system gates. Redeem only after you actually use the reward.</p>
        <ul className="unlock-list">
          {unlocks.map((unlock) => (
            <li key={unlock.id}>
              <div>
                <strong>{unlock.contract_title}</strong>
                <small>{unlock.date_local}</small>
              </div>
              {unlock.status === "unlocked" ? (
                <button
                  type="button"
                  className="primary"
                  onClick={() => redeemUnlock.mutate(unlock.id)}
                  disabled={redeemUnlock.isPending}
                >
                  Redeem
                </button>
              ) : (
                <span className={`tag status-${unlock.status}`}>{unlock.status}</span>
              )}
            </li>
          ))}
          {unlocks.length === 0 ? <li className="empty">No unlock events yet.</li> : null}
        </ul>
      </section>
    </div>
  );
}
