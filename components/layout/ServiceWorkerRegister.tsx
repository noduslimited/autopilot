"use client";

import { useEffect } from "react";

// Source: TRD section 2 ("PWA handles carer mobile") + section 11.2.
// Registered only in the carer layout — the manager and family portals
// aren't PWA-installable per the TRD's scope.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Registration failure shouldn't break the app — the PWA install
        // prompt just won't be available.
      });
    }
  }, []);

  return null;
}
