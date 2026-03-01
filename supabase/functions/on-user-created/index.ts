import { createClient } from "https://esm.sh/@supabase/supabase-js@2.54.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false
  }
});

Deno.serve(async (request) => {
  const payload = await request.json().catch(() => null);
  const userId = payload?.record?.id;

  if (!userId || typeof userId !== "string") {
    return new Response(JSON.stringify({ error: "Missing user id" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const { error: profileError } = await admin.from("profiles").upsert({ id: userId });

  if (profileError) {
    return new Response(JSON.stringify({ error: profileError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
});
