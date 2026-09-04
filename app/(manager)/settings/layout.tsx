import { SettingsNav } from "./SettingsNav";
import { MobileSettingsBackBar } from "./MobileSettingsBackBar";

// Source: PRD section 4.10 (Settings layout: left nav 180px + content
// area) on desktop. On mobile (Gokul, item 10, 2026-09-03), the side nav
// is replaced entirely — /settings itself becomes a stacked category
// list (SettingsIndexClient) and every sub-page renders full-screen with
// a "Back to Settings" link, the same tap-through pattern already used
// throughout the carer and family mobile portals.
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-6 p-5">
      <div className="hidden lg:block">
        <SettingsNav />
      </div>
      <div className="min-w-0 flex-1">
        <MobileSettingsBackBar />
        {children}
      </div>
    </div>
  );
}
