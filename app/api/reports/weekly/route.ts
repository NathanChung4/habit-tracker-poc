import { NextRequest, NextResponse } from "next/server";
import { getWeeklyReport } from "@/lib/data";
import { requireApiUser } from "@/lib/api-auth";
import { reportWeeklyQuerySchema } from "@/lib/validators";

export async function GET(request: NextRequest) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  try {
    const parsed = reportWeeklyQuerySchema.parse({
      weeks: request.nextUrl.searchParams.get("weeks") ? Number(request.nextUrl.searchParams.get("weeks")) : undefined
    });
    const rows = await getWeeklyReport(auth.supabase, auth.user.id, parsed.weeks);
    return NextResponse.json({ rows });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
