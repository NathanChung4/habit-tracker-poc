import { NextRequest, NextResponse } from "next/server";
import { deleteHabit, updateHabit } from "@/lib/data";
import { requireApiUser } from "@/lib/api-auth";

interface Params {
  params: Promise<{
    id: string;
  }>;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const payload = await request.json();
    const habit = await updateHabit(auth.supabase, auth.user.id, id, payload);
    return NextResponse.json({ habit });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    await deleteHabit(auth.supabase, auth.user.id, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
