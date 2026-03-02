import { beforeEach, describe, expect, it, vi } from "vitest";

const requireApiUserMock = vi.fn();
const ensureProfileMock = vi.fn();
const updateProfileSettingsMock = vi.fn();

vi.mock("@/lib/api-auth", () => ({
  requireApiUser: (...args: any[]) => requireApiUserMock(...args)
}));

vi.mock("@/lib/data", () => ({
  ensureProfile: (...args: any[]) => ensureProfileMock(...args),
  updateProfileSettings: (...args: any[]) => updateProfileSettingsMock(...args)
}));

import { GET, PATCH } from "@/app/api/settings/route";

const authOk = {
  user: { id: "user-123" },
  supabase: { tag: "mock" }
};

const profile = {
  id: "user-123",
  timezone: "America/Chicago",
  cutoff_time: "04:00:00",
  protection_tokens: 3
};

describe("settings api route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue(authOk);
  });

  it("GET returns current settings", async () => {
    ensureProfileMock.mockResolvedValue(profile);

    const response = (await GET()) as Response;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(ensureProfileMock).toHaveBeenCalledWith(authOk.supabase, authOk.user.id);
    expect(body).toEqual({
      settings: {
        timezone: "America/Chicago",
        cutoffTime: "04:00:00",
        protectionTokens: 3
      }
    });
  });

  it("PATCH updates settings and returns normalized payload", async () => {
    const payload = {
      timezone: "America/New_York",
      cutoffTime: "05:00:00",
      protectionTokens: 4
    };
    updateProfileSettingsMock.mockResolvedValue({
      ...profile,
      timezone: "America/New_York",
      cutoff_time: "05:00:00",
      protection_tokens: 4
    });

    const response = (await PATCH(
      new Request("http://localhost/api/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      }) as any
    )) as Response;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(updateProfileSettingsMock).toHaveBeenCalledWith(authOk.supabase, authOk.user.id, payload);
    expect(body).toEqual({
      settings: {
        timezone: "America/New_York",
        cutoffTime: "05:00:00",
        protectionTokens: 4
      }
    });
  });

  it("returns auth error when unauthorized", async () => {
    requireApiUserMock.mockResolvedValue({
      error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    });

    const response = (await GET()) as Response;
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: "Unauthorized" });
    expect(ensureProfileMock).not.toHaveBeenCalled();
  });

  it("maps read errors to 500", async () => {
    ensureProfileMock.mockRejectedValue(new Error("db exploded"));

    const response = (await GET()) as Response;
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "db exploded" });
  });

  it("maps patch errors to 400", async () => {
    updateProfileSettingsMock.mockRejectedValue(new Error("invalid settings"));

    const response = (await PATCH(
      new Request("http://localhost/api/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ timezone: "UTC", cutoffTime: "99:99", protectionTokens: -1 })
      }) as any
    )) as Response;
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "invalid settings" });
  });
});
