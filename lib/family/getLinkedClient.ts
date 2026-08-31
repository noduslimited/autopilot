import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// Source: Information Architecture Document section 9 ("Any attempt to
// access /family/* with an unlinked account returns a 403 with the
// message..."). Middleware only checks role (family_nok), not whether a
// family_nok row actually exists for this user — that's a per-record
// check, same tier as an RLS-scoped fetch returning null, so it belongs
// here rather than in proxy.ts (which would need an extra DB round trip
// on every request for a case that should be rare in practice).
export const UNLINKED_ACCOUNT_MESSAGE = "This page is not available. Please contact the care team.";

export async function getLinkedClientId(supabase: SupabaseClient<Database>, userId: string): Promise<string | null> {
  const { data } = await supabase.from("family_nok").select("client_id").eq("user_id", userId).maybeSingle();
  return data?.client_id ?? null;
}
