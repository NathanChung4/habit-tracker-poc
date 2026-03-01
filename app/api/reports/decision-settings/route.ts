import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";
import { getDecisionDiagnosticsSettings, updateDecisionDiagnosticsSettings } from "@/lib/data";

export async function GET() {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  try {
    const settings = await getDecisionDiagnosticsSettings(auth.supabase, auth.user.id);
    return NextResponse.json({ settings });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  try {
    const payload = await request.json();
    const settings = await updateDecisionDiagnosticsSettings(auth.supabase, auth.user.id, payload);
    return NextResponse.json({ settings });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
