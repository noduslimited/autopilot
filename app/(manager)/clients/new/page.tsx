import { createClient } from "@/lib/supabase/server";
import { AddClientForm } from "./AddClientForm";

export default async function NewClientPage() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  const { data: manager } = await supabase.from("users").select("org_id").eq("id", authUser!.id).single();

  const { data: staff } = await supabase
    .from("users")
    .select("id, first_name, last_name")
    .eq("org_id", manager!.org_id)
    .eq("role", "carer")
    .eq("status", "active")
    .order("first_name");

  return <AddClientForm staff={staff ?? []} />;
}
