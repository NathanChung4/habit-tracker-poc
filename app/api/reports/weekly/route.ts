import { NextRequest, NextResponse } from "next/server";
import { getWeeklyReport } from "@/lib/data";
import { requireApiUser } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  try {
    const weeks = Number(request.nextUrl.searchParams.get("weeks") ?? "8");
    const rows = await getWeeklyReport(auth.supabase, auth.user.id, Number.isFinite(weeks) ? weeks : 8);
    return NextResponse.json({ rows });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
