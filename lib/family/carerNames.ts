import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// Family members can't read carers' users rows under RLS, so a joined
// carer name always came back empty and the portal showed just "Carer".
// Resolved here with the admin client, limited to the exact carer IDs on
// visits the family member is already allowed to see (first/last name only).
export async function carerNames(
  admin: SupabaseClient<Database>,
  ids: (string | null | undefined)[],
): Promise<Map<string, { first_name: string; last_name: string }>> {
  const unique = [...new Set(ids.filter((id): id is string => !!id))];
  if (unique.length === 0) return new Map();
  const { data } = await admin.from("users").select("id, first_name, last_name").in("id", unique);
  return new Map((data ?? []).map((u) => [u.id, { first_name: u.first_name, last_name: u.last_name }]));
}
