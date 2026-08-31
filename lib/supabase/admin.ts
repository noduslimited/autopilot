import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// Service-role client — bypasses RLS entirely. Server-side only: used for
// admin operations that must run before an authenticated users row exists
// (e.g. organisation creation at registration) or that need cross-org
// access (invitation sending, data export). Never import this file from a
// client component. Source: TRD section 6.4, CLAUDE.md section 15.
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
