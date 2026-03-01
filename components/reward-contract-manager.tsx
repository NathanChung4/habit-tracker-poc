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

interface RewardContractCreatePayload {
  title: string;
  threshold: number;
  isActive: boolean;
}

interface RewardContractPatchRequest {
  id: string;
  payload: RewardContractPatchPayload;
  source: "edit" | "actions";
}

type ActionRetryState =
  | { type: "patch"; request: RewardContractPatchRequest }
  | { type: "delete"; id: string }
  | null;

interface RewardContractsMutationContext {
  previous: RewardContractItem[];
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
  const [createRetryPayload, setCreateRetryPayload] = useState<RewardContractCreatePayload | null>(null);
  const [editRetryRequest, setEditRetryRequest] = useState<RewardContractPatchRequest | null>(null);
  const [actionRetry, setActionRetry] = useState<ActionRetryState>(null);

  const createMutation = useMutation({
    mutationFn: async (payload: RewardContractCreatePayload) => {
      const response = await fetch("/api/rewards/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Could not create reward contract" }));
        throw new Error(payload.error ?? "Could not create reward contract");
      }

      return response.json();
    },
    retry: 1,
    onSuccess: (result) => {
      queryClient.setQueryData<RewardContractItem[]>(queryKey, (current = []) => [result.contract, ...current]);
      setTitle("");
      setThreshold(1);
      setIsActive(true);
      setCreateError(null);
      setCreateRetryPayload(null);
    },
    onError: (error, payload) => {
      setCreateError(error instanceof Error ? error.message : "Could not create reward contract");
      setCreateRetryPayload(payload);
    }
  });

  const patchMutation = useMutation({
    mutationFn: async ({ id, payload }: RewardContractPatchRequest) => {
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
    retry: 1,
    onMutate: async (request) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<RewardContractItem[]>(queryKey) ?? [];

      if (request.source === "actions") {
        queryClient.setQueryData<RewardContractItem[]>(queryKey, (current = []) =>
          current.map((contract) =>
            contract.id === request.id
              ? {
                  ...contract,
                  title: request.payload.title ?? contract.title,
                  threshold: request.payload.threshold ?? contract.threshold,
                  is_active: request.payload.isActive ?? contract.is_active
                }
              : contract
          )
        );
      }

      return { previous } satisfies RewardContractsMutationContext;
    },
    onSuccess: (result) => {
      queryClient.setQueryData<RewardContractItem[]>(queryKey, (current = []) =>
        current.map((contract) => (contract.id === result.contract.id ? result.contract : contract))
      );
      if (editingId === result.contract.id) {
        setEditingId(null);
      }
      setEditError(null);
      setEditRetryRequest(null);
      setActionError(null);
      setActionRetry(null);
    },
    onError: (error, request, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      const message = error instanceof Error ? error.message : "Could not update reward contract";
      if (request.source === "edit") {
        setEditError(message);
        setEditRetryRequest(request);
      } else {
        setActionError(message);
        setActionRetry({ type: "patch", request });
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
    retry: 1,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<RewardContractItem[]>(queryKey) ?? [];
      if (editingId === id) {
        setEditingId(null);
        setEditError(null);
        setEditRetryRequest(null);
      }

      queryClient.setQueryData<RewardContractItem[]>(queryKey, (current = []) =>
        current.filter((contract) => contract.id !== id)
      );

      return { previous } satisfies RewardContractsMutationContext;
    },
    onSuccess: ({ id }) => {
      queryClient.setQueryData<RewardContractItem[]>(queryKey, (current = []) =>
        current.filter((contract) => contract.id !== id)
      );
      setActionError(null);
      setActionRetry(null);
    },
    onError: (error, id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      setActionError(error instanceof Error ? error.message : "Could not delete reward contract");
      setActionRetry({ type: "delete", id });
    }
  });

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    const nextThreshold = Math.max(0, Math.min(1, threshold));

    setCreateError(null);
    setCreateRetryPayload(null);
    createMutation.mutate({
      title: trimmedTitle,
      threshold: nextThreshold,
      isActive
    });
  };

  const startEditing = (contract: RewardContractItem) => {
    setEditingId(contract.id);
    setEditTitle(contract.title);
    setEditThreshold(contract.threshold);
    setEditError(null);
    setEditRetryRequest(null);
    setActionError(null);
    setActionRetry(null);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditError(null);
    setEditRetryRequest(null);
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
    setEditRetryRequest(null);
    patchMutation.mutate({ id: contract.id, payload, source: "edit" });
  };

  const retryLastAction = () => {
    if (!actionRetry) return;

    if (actionRetry.type === "delete") {
      setActionError(null);
      deleteMutation.mutate(actionRetry.id);
      return;
    }

    setActionError(null);
    patchMutation.mutate(actionRetry.request);
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
            <div className="error-row" role="alert">
              <p className="error-text">{createError}</p>
              {createRetryPayload ? (
                <button
                  type="button"
                  className="ghost"
                  onClick={() => {
                    setCreateError(null);
                    createMutation.mutate(createRetryPayload);
                  }}
                  disabled={createMutation.isPending}
                >
                  Retry
                </button>
              ) : null}
            </div>
          ) : null}
        </form>
      </section>

      <section className="panel">
        <h3>Reward Contracts</h3>
        {actionError ? (
          <div className="error-row" role="alert">
            <p className="error-text">{actionError}</p>
            {actionRetry ? (
              <button
                type="button"
                className="ghost"
                onClick={retryLastAction}
                disabled={patchMutation.isPending || deleteMutation.isPending}
              >
                Retry
              </button>
            ) : null}
          </div>
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
                    <div className="error-row" role="alert">
                      <p className="error-text">{editError}</p>
                      {editRetryRequest ? (
                        <button
                          type="button"
                          className="ghost"
                          onClick={() => {
                            setEditError(null);
                            patchMutation.mutate(editRetryRequest);
                          }}
                          disabled={patchMutation.isPending}
                        >
                          Retry
                        </button>
                      ) : null}
                    </div>
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
                      onClick={() => {
                        setActionError(null);
                        setActionRetry(null);
                        patchMutation.mutate({
                          id: contract.id,
                          payload: { isActive: !contract.is_active },
                          source: "actions"
                        });
                      }}
                      disabled={patchMutation.isPending || deleteMutation.isPending}
                    >
                      {contract.is_active ? "Pause" : "Activate"}
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => {
                        setActionError(null);
                        setActionRetry(null);
                        deleteMutation.mutate(contract.id);
                      }}
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
