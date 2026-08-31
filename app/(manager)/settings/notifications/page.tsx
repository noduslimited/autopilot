import { createClient } from "@/lib/supabase/server";
import { NotificationsForm } from "./NotificationsForm";

// Source: PRD section 4.10 (Integrations — Notifications)
export default async function NotificationsSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: managerRow } = await supabase.from("users").select("org_id").eq("id", user!.id).single();
  const { data: org } = await supabase.from("organisations").select("id, notification_settings").eq("id", managerRow!.org_id).single();

  if (!org) return null;

  return <NotificationsForm orgId={org.id} initialSettings={(org.notification_settings as Record<string, boolean>) ?? {}} />;
}
