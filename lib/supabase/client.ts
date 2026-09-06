import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// Perf pass, 2026-09-06: memoised at module scope so every call site in
// the same browser tab reuses one client instance instead of constructing
// a fresh wrapper (and its internal realtime/auth-listener setup) on every
// call — dozens of components call createClient() per interaction. Safe
// specifically because this is the browser client for a single signed-in
// user's own tab; the equivalent server-side client (lib/supabase/server.ts)
// is deliberately NOT memoised the same way — @supabase/ssr's server
// client is bound to one request's cookies, and sharing an instance across
// concurrent requests would risk leaking one user's session into another's.
let browserClient: SupabaseClient<Database> | undefined;

export function createClient() {
  if (!browserClient) {
    browserClient = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return browserClient;
}
