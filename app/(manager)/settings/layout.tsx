import { SettingsNav } from "./SettingsNav";

// Source: PRD section 4.10 (Settings layout: left nav 180px + content area)
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-6 p-5">
      <SettingsNav />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
