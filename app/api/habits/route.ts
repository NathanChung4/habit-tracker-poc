import { NextRequest, NextResponse } from "next/server";
import { createHabit, listHabits } from "@/lib/data";
import { requireApiUser } from "@/lib/api-auth";

export async function GET() {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  try {
    const habits = await listHabits(auth.supabase, auth.user.id);
    return NextResponse.json({ habits });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  try {
    const payload = await request.json();
    const habit = await createHabit(auth.supabase, auth.user.id, payload);
    return NextResponse.json({ habit }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
