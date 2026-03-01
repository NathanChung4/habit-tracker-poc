import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";
import { listRewardContracts } from "@/lib/data";

export async function GET() {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  try {
    const contracts = await listRewardContracts(auth.supabase, auth.user.id);
    return NextResponse.json({ contracts });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST() {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  return NextResponse.json(
    { error: "POST rewards/contracts is not enabled yet. This Phase C step is read-only." },
    { status: 405 }
  );
}
