import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";

export async function PATCH() {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  return NextResponse.json(
    { error: "Rewards API is disabled in Phase B. It will return in Phase C." },
    { status: 410 }
  );
}
