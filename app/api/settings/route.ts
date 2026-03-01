import { NextRequest, NextResponse } from "next/server";
import { ensureProfile, updateProfileSettings } from "@/lib/data";
import { requireApiUser } from "@/lib/api-auth";

export async function GET() {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  try {
    const profile = await ensureProfile(auth.supabase, auth.user.id);
    return NextResponse.json({
      settings: {
        timezone: profile.timezone,
        cutoffTime: profile.cutoff_time,
        protectionTokens: profile.protection_tokens
      }
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  try {
    const payload = await request.json();
    const profile = await updateProfileSettings(auth.supabase, auth.user.id, payload);
    return NextResponse.json({
      settings: {
        timezone: profile.timezone,
        cutoffTime: profile.cutoff_time,
        protectionTokens: profile.protection_tokens
      }
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
