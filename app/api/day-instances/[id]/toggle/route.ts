import { NextRequest, NextResponse } from "next/server";
import { toggleDayInstance } from "@/lib/data";
import { requireApiUser } from "@/lib/api-auth";

interface Params {
  params: {
    id: string;
  };
}

export async function POST(_request: NextRequest, { params }: Params) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  try {
    const { id } = params;
    const dayInstance = await toggleDayInstance(auth.supabase, auth.user.id, id);
    return NextResponse.json({ dayInstance });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
