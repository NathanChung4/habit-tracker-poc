import { NextRequest, NextResponse } from "next/server";
import { getDailyReport } from "@/lib/data";
import { requireApiUser } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  try {
    const start = request.nextUrl.searchParams.get("start") ?? undefined;
    const end = request.nextUrl.searchParams.get("end") ?? undefined;
    const rows = await getDailyReport(auth.supabase, auth.user.id, start, end);
    return NextResponse.json({ rows });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
