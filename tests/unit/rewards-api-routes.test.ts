import { beforeEach, describe, expect, it, vi } from "vitest";

const requireApiUserMock = vi.fn();
const listRewardContractsMock = vi.fn();
const createRewardContractMock = vi.fn();
const updateRewardContractMock = vi.fn();
const deleteRewardContractMock = vi.fn();
const redeemRewardUnlockMock = vi.fn();

vi.mock("@/lib/api-auth", () => ({
  requireApiUser: (...args: any[]) => requireApiUserMock(...args)
}));

vi.mock("@/lib/data", () => ({
  listRewardContracts: (...args: any[]) => listRewardContractsMock(...args),
  createRewardContract: (...args: any[]) => createRewardContractMock(...args),
  updateRewardContract: (...args: any[]) => updateRewardContractMock(...args),
  deleteRewardContract: (...args: any[]) => deleteRewardContractMock(...args),
  redeemRewardUnlock: (...args: any[]) => redeemRewardUnlockMock(...args)
}));

import { GET as getContracts, POST as postContracts } from "@/app/api/rewards/contracts/route";
import { DELETE as deleteContract, PATCH as patchContract } from "@/app/api/rewards/contracts/[id]/route";
import { POST as postRedeem } from "@/app/api/rewards/[unlockId]/redeem/route";

const authOk = {
  user: { id: "user-123" },
  supabase: { tag: "mock" }
};

describe("rewards api routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue(authOk);
  });

  it("GET /api/rewards/contracts returns contracts for authenticated user", async () => {
    const contracts = [{ id: "c1", title: "Reward", threshold: 1, is_active: true }];
    listRewardContractsMock.mockResolvedValue(contracts);

    const response = (await getContracts()) as Response;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(listRewardContractsMock).toHaveBeenCalledWith(authOk.supabase, authOk.user.id);
    expect(body).toEqual({ contracts });
  });

  it("POST /api/rewards/contracts creates a contract and returns 201", async () => {
    const payload = { title: "Movie", threshold: 0.8, isActive: true };
    const contract = { id: "c2", ...payload, is_active: true, user_id: "user-123" };
    createRewardContractMock.mockResolvedValue(contract);

    const response = (await postContracts(
      new Request("http://localhost/api/rewards/contracts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      }) as any
    )) as Response;
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(createRewardContractMock).toHaveBeenCalledWith(authOk.supabase, authOk.user.id, payload);
    expect(body).toEqual({ contract });
  });

  it("PATCH /api/rewards/contracts/:id updates a contract", async () => {
    const payload = { isActive: false };
    const updated = { id: "c1", title: "Reward", threshold: 1, is_active: false, user_id: "user-123" };
    updateRewardContractMock.mockResolvedValue(updated);

    const response = (await patchContract(
      new Request("http://localhost/api/rewards/contracts/c1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      }) as any,
      { params: Promise.resolve({ id: "c1" }) }
    )) as Response;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(updateRewardContractMock).toHaveBeenCalledWith(authOk.supabase, authOk.user.id, "c1", payload);
    expect(body).toEqual({ contract: updated });
  });

  it("DELETE /api/rewards/contracts/:id deletes a contract", async () => {
    deleteRewardContractMock.mockResolvedValue(undefined);

    const response = (await deleteContract(
      new Request("http://localhost/api/rewards/contracts/c1", { method: "DELETE" }) as any,
      { params: Promise.resolve({ id: "c1" }) }
    )) as Response;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(deleteRewardContractMock).toHaveBeenCalledWith(authOk.supabase, authOk.user.id, "c1");
    expect(body).toEqual({ success: true });
  });

  it("POST /api/rewards/:unlockId/redeem redeems an unlock", async () => {
    const redemption = { id: "u1", reward_contract_id: "c1", status: "redeemed" };
    redeemRewardUnlockMock.mockResolvedValue(redemption);

    const response = (await postRedeem(
      new Request("http://localhost/api/rewards/u1/redeem", { method: "POST" }) as any,
      { params: Promise.resolve({ unlockId: "u1" }) }
    )) as Response;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(redeemRewardUnlockMock).toHaveBeenCalledWith(authOk.supabase, authOk.user.id, "u1");
    expect(body).toEqual({ redemption });
  });

  it("returns auth error response when user is not authenticated", async () => {
    requireApiUserMock.mockResolvedValue({
      error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    });

    const response = (await getContracts()) as Response;
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: "Unauthorized" });
    expect(listRewardContractsMock).not.toHaveBeenCalled();
  });

  it("maps list errors to 500 for GET contracts", async () => {
    listRewardContractsMock.mockRejectedValue(new Error("db exploded"));

    const response = (await getContracts()) as Response;
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "db exploded" });
  });

  it("maps write errors to 400 for contract and redeem mutations", async () => {
    createRewardContractMock.mockRejectedValueOnce(new Error("invalid contract"));
    updateRewardContractMock.mockRejectedValueOnce(new Error("invalid update"));
    deleteRewardContractMock.mockRejectedValueOnce(new Error("cannot delete"));
    redeemRewardUnlockMock.mockRejectedValueOnce(new Error("not redeemable"));

    const createResponse = (await postContracts(
      new Request("http://localhost/api/rewards/contracts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "x", threshold: 0.5, isActive: true })
      }) as any
    )) as Response;
    const updateResponse = (await patchContract(
      new Request("http://localhost/api/rewards/contracts/c1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "x" })
      }) as any,
      { params: Promise.resolve({ id: "c1" }) }
    )) as Response;
    const deleteResponse = (await deleteContract(
      new Request("http://localhost/api/rewards/contracts/c1", { method: "DELETE" }) as any,
      { params: Promise.resolve({ id: "c1" }) }
    )) as Response;
    const redeemResponse = (await postRedeem(
      new Request("http://localhost/api/rewards/u1/redeem", { method: "POST" }) as any,
      { params: Promise.resolve({ unlockId: "u1" }) }
    )) as Response;

    expect(createResponse.status).toBe(400);
    expect(updateResponse.status).toBe(400);
    expect(deleteResponse.status).toBe(400);
    expect(redeemResponse.status).toBe(400);
  });
});
