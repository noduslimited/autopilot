import type { ReactNode } from "react";
import { BottomNav } from "./BottomNav";

// Source: PRD section 6.2 ("persistent" bottom nav across all family
// screens — no hide-on-detail exception like the carer portal's Visit
// Detail screen).
export function FamilyShell({ children, messagingEnabled = true }: { children: ReactNode; messagingEnabled?: boolean }) {
  return (
    <div className="mx-auto min-h-screen max-w-[480px] bg-page-bg">
      <div className="pb-16">{children}</div>
      <div className="fixed bottom-0 left-1/2 z-30 w-full max-w-[480px] -translate-x-1/2">
        <BottomNav role="family_nok" messagingEnabled={messagingEnabled} />
      </div>
    </div>
  );
}
