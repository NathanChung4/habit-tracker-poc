import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";
import { getConsistencyEvents } from "@/lib/data";
import { consistencyEventsQuerySchema } from "@/lib/validators";

export async function GET(request: NextRequest) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  try {
    const parsed = consistencyEventsQuerySchema.parse({
      limit: request.nextUrl.searchParams.get("limit")
        ? Number(request.nextUrl.searchParams.get("limit"))
        : undefined,
      type: request.nextUrl.searchParams.get("type") ?? undefined,
      from: request.nextUrl.searchParams.get("from") ?? undefined,
      to: request.nextUrl.searchParams.get("to") ?? undefined
    });

    const events = await getConsistencyEvents(auth.supabase, auth.user.id, {
      limit: parsed.limit,
      type: parsed.type,
      from: parsed.from,
      to: parsed.to
    });

    return NextResponse.json({ events });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
