import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";
import { redeemRewardUnlock } from "@/lib/data";

interface Params {
  params: Promise<{
    unlockId: string;
  }>;
}

export async function POST(_request: NextRequest, { params }: Params) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  try {
    const { unlockId } = await params;
    const redemption = await redeemRewardUnlock(auth.supabase, auth.user.id, unlockId);
    return NextResponse.json({ redemption });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
