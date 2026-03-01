import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const requireApiUserMock = vi.fn();
const getConsistencyEventsMock = vi.fn();

vi.mock("@/lib/api-auth", () => ({
  requireApiUser: (...args: any[]) => requireApiUserMock(...args)
}));

vi.mock("@/lib/data", () => ({
  getConsistencyEvents: (...args: any[]) => getConsistencyEventsMock(...args)
}));

import { GET } from "@/app/api/events/consistency/route";

const authOk = {
  user: { id: "user-123" },
  supabase: { tag: "mock" }
};

describe("consistency events api route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue(authOk);
  });

  it("returns filtered consistency events for authenticated user", async () => {
    const events = [
      {
        id: "evt-1",
        eventType: "reward_unlocked",
        dateLocal: "2026-03-01",
        createdAt: "2026-03-01T12:00:00.000Z",
        message: "Movie was unlocked for this day."
      }
    ];
    getConsistencyEventsMock.mockResolvedValue(events);

    const response = (await GET(
      new NextRequest(
        "http://localhost/api/events/consistency?limit=10&type=reward_unlocked&from=2026-03-01&to=2026-03-07"
      ) as any
    )) as Response;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(getConsistencyEventsMock).toHaveBeenCalledWith(authOk.supabase, authOk.user.id, {
      limit: 10,
      type: "reward_unlocked",
      from: "2026-03-01",
      to: "2026-03-07"
    });
    expect(body).toEqual({ events });
  });

  it("returns auth error when unauthorized", async () => {
    requireApiUserMock.mockResolvedValue({
      error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    });

    const response = (await GET(new NextRequest("http://localhost/api/events/consistency") as any)) as Response;
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: "Unauthorized" });
    expect(getConsistencyEventsMock).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid query params", async () => {
    const response = (await GET(
      new NextRequest("http://localhost/api/events/consistency?limit=10&from=2026-03-10&to=2026-03-01") as any
    )) as Response;
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(String(body.error ?? "")).toContain("from");
    expect(getConsistencyEventsMock).not.toHaveBeenCalled();
  });
});
