"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

interface RewardContractItem {
  id: string;
  user_id: string;
  title: string;
  rule_type: string;
  threshold: number;
  is_active: boolean;
  created_at: string;
}

export function RewardContractManager({ initialContracts }: { initialContracts: RewardContractItem[] }) {
  const queryClient = useQueryClient();
  const queryKey = ["reward-contracts"];

  const { data: contracts = [] } = useQuery({
    queryKey,
    queryFn: async () => initialContracts,
    initialData: initialContracts
  });

  const [title, setTitle] = useState("");
  const [threshold, setThreshold] = useState(1);
  const [isActive, setIsActive] = useState(true);

  const createMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/rewards/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          threshold,
          isActive
        })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Could not create reward contract" }));
        throw new Error(payload.error ?? "Could not create reward contract");
      }

      return response.json();
    },
    onSuccess: (result) => {
      queryClient.setQueryData<RewardContractItem[]>(queryKey, (current = []) => [result.contract, ...current]);
      setTitle("");
      setThreshold(1);
      setIsActive(true);
    }
  });

  const patchMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: { isActive: boolean } }) => {
      const response = await fetch(`/api/rewards/contracts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: "Could not update reward contract" }));
        throw new Error(body.error ?? "Could not update reward contract");
      }

      return response.json();
    },
    onSuccess: (result) => {
      queryClient.setQueryData<RewardContractItem[]>(queryKey, (current = []) =>
        current.map((contract) => (contract.id === result.contract.id ? result.contract : contract))
      );
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/rewards/contracts/${id}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: "Could not delete reward contract" }));
        throw new Error(body.error ?? "Could not delete reward contract");
      }

      return { id };
    },
    onSuccess: ({ id }) => {
      queryClient.setQueryData<RewardContractItem[]>(queryKey, (current = []) =>
        current.filter((contract) => contract.id !== id)
      );
    }
  });

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    await createMutation.mutateAsync();
  };

  return (
    <div className="reward-layout">
      <section className="panel">
        <h3>Create Reward Contract</h3>
        <form className="stack-form" onSubmit={onSubmit}>
          <label>
            Reward title
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="TikTok 30 minutes"
              required
            />
          </label>
          <label>
            Unlock threshold (0-1)
            <input
              type="number"
              min={0}
              max={1}
              step="0.05"
              value={threshold}
              onChange={(event) => setThreshold(Number(event.target.value) || 0)}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
            />
            Active
          </label>
          <button type="submit" className="primary" disabled={createMutation.isPending || !title.trim()}>
            Create contract
          </button>
          <p className="muted">Example: `1.0` means reward unlocks only on a perfect day.</p>
        </form>
      </section>

      <section className="panel">
        <h3>Reward Contracts</h3>
        <ul className="contract-list">
          {contracts.map((contract) => (
            <li key={contract.id}>
              <div>
                <strong>{contract.title}</strong>
                <small>
                  {Math.round(contract.threshold * 100)}% threshold • {contract.is_active ? "active" : "inactive"}
                </small>
              </div>
              <div className="contract-actions">
                <button
                  type="button"
                  className="ghost"
                  onClick={() =>
                    patchMutation.mutate({
                      id: contract.id,
                      payload: { isActive: !contract.is_active }
                    })
                  }
                  disabled={patchMutation.isPending || deleteMutation.isPending}
                >
                  {contract.is_active ? "Pause" : "Activate"}
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => deleteMutation.mutate(contract.id)}
                  disabled={patchMutation.isPending || deleteMutation.isPending}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
          {contracts.length === 0 ? <li className="empty">No reward contracts yet.</li> : null}
        </ul>
      </section>
    </div>
  );
}
