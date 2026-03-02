import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const requireApiUserMock = vi.fn();
const getDailyReportMock = vi.fn();
const getWeeklyReportMock = vi.fn();

vi.mock("@/lib/api-auth", () => ({
  requireApiUser: (...args: any[]) => requireApiUserMock(...args)
}));

vi.mock("@/lib/data", () => ({
  getDailyReport: (...args: any[]) => getDailyReportMock(...args),
  getWeeklyReport: (...args: any[]) => getWeeklyReportMock(...args)
}));

import { GET as getDaily } from "@/app/api/reports/daily/route";
import { GET as getWeekly } from "@/app/api/reports/weekly/route";

const authOk = {
  user: { id: "user-123" },
  supabase: { tag: "mock" }
};

describe("reports api routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue(authOk);
  });

  it("GET /api/reports/daily returns rows for valid query", async () => {
    const rows = [{ date_local: "2026-03-01", completion_rate: 1 }];
    getDailyReportMock.mockResolvedValue(rows);

    const response = (await getDaily(
      new NextRequest("http://localhost/api/reports/daily?start=2026-02-20&end=2026-03-01") as any
    )) as Response;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(getDailyReportMock).toHaveBeenCalledWith(authOk.supabase, authOk.user.id, "2026-02-20", "2026-03-01");
    expect(body).toEqual({ rows });
  });

  it("GET /api/reports/weekly defaults weeks to 8", async () => {
    const rows = [{ weekStartDate: "2026-02-23", averageCompletionRate: 0.9 }];
    getWeeklyReportMock.mockResolvedValue(rows);

    const response = (await getWeekly(new NextRequest("http://localhost/api/reports/weekly") as any)) as Response;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(getWeeklyReportMock).toHaveBeenCalledWith(authOk.supabase, authOk.user.id, 8);
    expect(body).toEqual({ rows });
  });

  it("returns auth error when unauthorized", async () => {
    requireApiUserMock.mockResolvedValue({
      error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    });

    const response = (await getDaily(new NextRequest("http://localhost/api/reports/daily") as any)) as Response;
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: "Unauthorized" });
    expect(getDailyReportMock).not.toHaveBeenCalled();
    expect(getWeeklyReportMock).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid daily date range", async () => {
    const response = (await getDaily(
      new NextRequest("http://localhost/api/reports/daily?start=2026-03-10&end=2026-03-01") as any
    )) as Response;
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(String(body.error ?? "")).toContain("start");
    expect(getDailyReportMock).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid weekly weeks query", async () => {
    const response = (await getWeekly(new NextRequest("http://localhost/api/reports/weekly?weeks=0") as any)) as Response;
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(String(body.error ?? "")).toContain("Number must be greater than or equal to 1");
    expect(getWeeklyReportMock).not.toHaveBeenCalled();
  });

  it("maps data layer errors to 400", async () => {
    getDailyReportMock.mockRejectedValueOnce(new Error("daily exploded"));
    getWeeklyReportMock.mockRejectedValueOnce(new Error("weekly exploded"));

    const dailyResponse = (await getDaily(new NextRequest("http://localhost/api/reports/daily") as any)) as Response;
    const weeklyResponse = (await getWeekly(new NextRequest("http://localhost/api/reports/weekly") as any)) as Response;

    expect(dailyResponse.status).toBe(400);
    expect(weeklyResponse.status).toBe(400);
  });
});
