import { beforeEach, describe, expect, it, vi } from "vitest";

const requireApiUserMock = vi.fn();
const getDecisionDiagnosticsSettingsMock = vi.fn();
const updateDecisionDiagnosticsSettingsMock = vi.fn();

vi.mock("@/lib/api-auth", () => ({
  requireApiUser: (...args: any[]) => requireApiUserMock(...args)
}));

vi.mock("@/lib/data", () => ({
  getDecisionDiagnosticsSettings: (...args: any[]) => getDecisionDiagnosticsSettingsMock(...args),
  updateDecisionDiagnosticsSettings: (...args: any[]) => updateDecisionDiagnosticsSettingsMock(...args)
}));

import { GET, PATCH } from "@/app/api/reports/decision-settings/route";

const authOk = {
  user: { id: "user-123" },
  supabase: { tag: "mock" }
};

const settings = {
  tokenWindowDays: 7,
  tokenUsageThreshold: 2,
  rewardWindowDays: 14,
  streakEvalWindowDays: 2
};

describe("decision diagnostics settings api route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue(authOk);
  });

  it("GET returns settings for authenticated user", async () => {
    getDecisionDiagnosticsSettingsMock.mockResolvedValue(settings);

    const response = (await GET()) as Response;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(getDecisionDiagnosticsSettingsMock).toHaveBeenCalledWith(authOk.supabase, authOk.user.id);
    expect(body).toEqual({ settings });
  });

  it("PATCH updates settings for authenticated user", async () => {
    const payload = { rewardWindowDays: 21 };
    updateDecisionDiagnosticsSettingsMock.mockResolvedValue({ ...settings, rewardWindowDays: 21 });

    const response = (await PATCH(
      new Request("http://localhost/api/reports/decision-settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      }) as any
    )) as Response;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(updateDecisionDiagnosticsSettingsMock).toHaveBeenCalledWith(authOk.supabase, authOk.user.id, payload);
    expect(body).toEqual({ settings: { ...settings, rewardWindowDays: 21 } });
  });

  it("returns auth error when unauthorized", async () => {
    requireApiUserMock.mockResolvedValue({
      error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    });

    const response = (await GET()) as Response;
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: "Unauthorized" });
    expect(getDecisionDiagnosticsSettingsMock).not.toHaveBeenCalled();
  });

  it("maps read errors to 500", async () => {
    getDecisionDiagnosticsSettingsMock.mockRejectedValue(new Error("db exploded"));

    const response = (await GET()) as Response;
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "db exploded" });
  });

  it("maps patch errors to 400", async () => {
    updateDecisionDiagnosticsSettingsMock.mockRejectedValue(new Error("invalid settings"));

    const response = (await PATCH(
      new Request("http://localhost/api/reports/decision-settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tokenWindowDays: 0 })
      }) as any
    )) as Response;
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "invalid settings" });
  });
});
