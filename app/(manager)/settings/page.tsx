import { redirect } from "next/navigation";

// Source: Information Architecture Document section 8 — "/settings redirects to /settings/organisation"
export default function SettingsIndexPage() {
  redirect("/settings/organisation");
}
