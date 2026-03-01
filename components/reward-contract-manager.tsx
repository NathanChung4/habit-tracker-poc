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

interface RewardContractPatchPayload {
  title?: string;
  threshold?: number;
  isActive?: boolean;
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editThreshold, setEditThreshold] = useState(1);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

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
      setCreateError(null);
    },
    onError: (error) => {
      setCreateError(error instanceof Error ? error.message : "Could not create reward contract");
    }
  });

  const patchMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: RewardContractPatchPayload }) => {
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
      if (editingId === result.contract.id) {
        setEditingId(null);
      }
      setEditError(null);
      setActionError(null);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Could not update reward contract";
      if (editingId) {
        setEditError(message);
      } else {
        setActionError(message);
      }
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
      setActionError(null);
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : "Could not delete reward contract");
    }
  });

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    setCreateError(null);
    createMutation.mutate();
  };

  const startEditing = (contract: RewardContractItem) => {
    setEditingId(contract.id);
    setEditTitle(contract.title);
    setEditThreshold(contract.threshold);
    setEditError(null);
    setActionError(null);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditError(null);
  };

  const onEditSubmit = async (event: FormEvent, contract: RewardContractItem) => {
    event.preventDefault();

    const trimmedTitle = editTitle.trim();
    if (!trimmedTitle) return;

    const nextThreshold = Math.max(0, Math.min(1, editThreshold));
    const payload: RewardContractPatchPayload = {};

    if (trimmedTitle !== contract.title) payload.title = trimmedTitle;
    if (nextThreshold !== contract.threshold) payload.threshold = nextThreshold;

    if (Object.keys(payload).length === 0) {
      cancelEditing();
      return;
    }

    setEditError(null);
    patchMutation.mutate({ id: contract.id, payload });
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
          {createError ? (
            <p className="error-text" role="alert">
              {createError}
            </p>
          ) : null}
        </form>
      </section>

      <section className="panel">
        <h3>Reward Contracts</h3>
        {actionError ? (
          <p className="error-text" role="alert">
            {actionError}
          </p>
        ) : null}
        <ul className="contract-list">
          {contracts.map((contract) => (
            <li key={contract.id}>
              {editingId === contract.id ? (
                <form className="inline-contract-edit" onSubmit={(event) => onEditSubmit(event, contract)}>
                  <label>
                    Reward title
                    <input
                      value={editTitle}
                      onChange={(event) => setEditTitle(event.target.value)}
                      maxLength={120}
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
                      value={editThreshold}
                      onChange={(event) => setEditThreshold(Number(event.target.value) || 0)}
                    />
                  </label>
                  <div className="contract-actions">
                    <button type="submit" className="primary" disabled={patchMutation.isPending || !editTitle.trim()}>
                      Save
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      onClick={cancelEditing}
                      disabled={patchMutation.isPending}
                    >
                      Cancel
                    </button>
                  </div>
                  {editError ? (
                    <p className="error-text" role="alert">
                      {editError}
                    </p>
                  ) : null}
                </form>
              ) : (
                <>
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
                      onClick={() => startEditing(contract)}
                      disabled={patchMutation.isPending || deleteMutation.isPending}
                    >
                      Edit
                    </button>
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
                </>
              )}
            </li>
          ))}
          {contracts.length === 0 ? <li className="empty">No reward contracts yet.</li> : null}
        </ul>
      </section>
    </div>
  );
}
