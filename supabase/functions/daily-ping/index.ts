// Source: CLAUDE.md section 13 (Infrastructure Cost Constraint) — "Daily
// ping Edge Function prevents pause" on Supabase's free tier (auto-pauses
// after 1 week with zero database activity). Session 14: Gokul deferred
// the Pro upgrade until a real paying client exists, so this is the load
// -bearing mitigation, not a redundant safety net. A trivial read against
// a real table is enough to register activity and reset the pause clock
// — no data is created or modified. Same deployment pattern as every
// other Edge Function in this project (Vault-stored service-role key,
// pg_cron + pg_net.http_post, --use-api deploy, no Docker).
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { error } = await supabase.from("organisations").select("id").limit(1);

  if (error) {
    console.error("daily-ping: query failed", error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, pinged_at: new Date().toISOString() }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
