import { SettingsIndexClient } from "./SettingsIndexClient";

// Source: Information Architecture Document section 8 — "/settings
// redirects to /settings/organisation" on desktop. On mobile (item 10,
// Gokul, 2026-09-03), this renders a real stacked category list instead
// — see SettingsIndexClient for why the redirect moved client-side.
export default function SettingsIndexPage() {
  return <SettingsIndexClient />;
}
