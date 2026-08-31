import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// Source: Business Model Document section 6.2 ("Usage-Based Billing
// Calculation"): "Billing is based on the number of active service users
// at the start of each billing month. A service user is active if they
// have at least one scheduled or completed visit in the current month.
// Archived or discharged service users do not count." Shared between the
// billing page's live display and the checkout route's line-item
// quantity, so both use the exact same definition.
function startOfMonthUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function startOfNextMonthUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

export async function getActiveServiceUserCount(supabase: SupabaseClient<Database>, orgId: string): Promise<number> {
  const { data } = await supabase
    .from("visits")
    .select("client_id, clients!inner(status)")
    .eq("org_id", orgId)
    .in("status", ["scheduled", "completed"])
    .gte("scheduled_start", startOfMonthUTC().toISOString())
    .lt("scheduled_start", startOfNextMonthUTC().toISOString())
    .eq("clients.status", "active");

  const uniqueClientIds = new Set((data ?? []).map((row) => row.client_id));
  return uniqueClientIds.size;
}
