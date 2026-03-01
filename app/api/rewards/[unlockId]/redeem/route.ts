import { NextRequest, NextResponse } from "next/server";
import { redeemRewardUnlock } from "@/lib/data";
import { requireApiUser } from "@/lib/api-auth";

interface Params {
  params: {
    unlockId: string;
  };
}

export async function POST(_request: NextRequest, { params }: Params) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  try {
    const { unlockId } = params;
    const redemption = await redeemRewardUnlock(auth.supabase, auth.user.id, unlockId);
    return NextResponse.json({ redemption });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
