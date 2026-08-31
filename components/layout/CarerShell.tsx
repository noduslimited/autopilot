"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { ServiceWorkerRegister } from "./ServiceWorkerRegister";
import { OfflineSyncListener } from "@/components/carer/OfflineSyncListener";

// Source: PRD section 5.1 ("persistent" bottom nav) — Sessions.md Session
// 9 step 3 explicitly calls for the nav to be hidden on Visit Detail, since
// that screen's own back-arrow header replaces it as the primary way back.
export function CarerShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const hideNav = pathname.startsWith("/visit/");

  return (
    <div className="mx-auto min-h-screen max-w-[480px] bg-page-bg">
      <ServiceWorkerRegister />
      <OfflineSyncListener />
      <div className={hideNav ? "" : "pb-16"}>{children}</div>
      {hideNav ? null : (
        <div className="fixed bottom-0 left-1/2 z-30 w-full max-w-[480px] -translate-x-1/2">
          <BottomNav role="carer" />
        </div>
      )}
    </div>
  );
}
