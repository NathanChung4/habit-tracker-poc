import { NextRequest, NextResponse } from "next/server";
import { updateRewardContract } from "@/lib/data";
import { requireApiUser } from "@/lib/api-auth";

interface Params {
  params: {
    id: string;
  };
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  try {
    const { id } = params;
    const payload = await request.json();
    const contract = await updateRewardContract(auth.supabase, auth.user.id, id, payload);
    return NextResponse.json({ contract });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
