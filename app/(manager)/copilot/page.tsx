import { createClient } from "@/lib/supabase/server";
import { CopilotChat, type NamedEntity } from "./CopilotChat";

// Source: PRD section 4.9 (AI Copilot)
export default async function CopilotPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: managerRow } = await supabase.from("users").select("first_name, last_name").eq("id", user!.id).single();

  const [{ data: staffRows }, { data: clientRows }] = await Promise.all([
    supabase.from("staff").select("id, users(first_name, last_name)"),
    supabase.from("clients").select("id, first_name, last_name").eq("status", "active"),
  ]);

  const entities: NamedEntity[] = [
    ...(staffRows ?? []).map((s) => {
      const u = Array.isArray(s.users) ? s.users[0] : s.users;
      return { id: s.id, name: u ? `${u.first_name} ${u.last_name}` : "", type: "staff" as const };
    }),
    ...(clientRows ?? []).map((c) => ({ id: c.id, name: `${c.first_name} ${c.last_name}`, type: "client" as const })),
  ].filter((e) => e.name);

  return (
    <CopilotChat
      managerName={managerRow ? `${managerRow.first_name} ${managerRow.last_name}` : "Manager"}
      managerFirstName={managerRow?.first_name ?? "Manager"}
      entities={entities}
    />
  );
}
