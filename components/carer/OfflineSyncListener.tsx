"use client";

import { useEffect } from "react";
import { replayQueue } from "@/lib/offline/replay";

// Source: TRD section 11.3. Mounted once in the carer shell — replays
// any IndexedDB-queued actions whenever the browser regains connectivity,
// and once on mount in case the app was reopened online with actions
// left over from a previous offline session.
export function OfflineSyncListener() {
  useEffect(() => {
    void replayQueue();

    function handleOnline() {
      void replayQueue();
    }

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, []);

  return null;
}
