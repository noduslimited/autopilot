"use client";

import { useEffect, useState } from "react";

// Source: CLAUDE.md section 16a — carer shift notifications via Web
// Push. Shown on /schedule (shift-related content) rather than
// auto-prompting on load, since browsers require (and users deserve) an
// explicit gesture before requesting notification permission.
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(new ArrayBuffer(rawData.length));
  for (let i = 0; i < rawData.length; i += 1) output[i] = rawData.charCodeAt(i);
  return output;
}

type PromptState = "checking" | "hidden" | "offer" | "enabling" | "enabled" | "denied" | "unsupported";

export function PushNotificationPrompt() {
  const [state, setState] = useState<PromptState>("checking");

  useEffect(() => {
    async function check() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setState("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setState("denied");
        return;
      }
      const registration = await navigator.serviceWorker.ready.catch(() => null);
      if (!registration) {
        setState("hidden");
        return;
      }
      const existing = await registration.pushManager.getSubscription();
      setState(existing ? "enabled" : "offer");
    }
    void check();
  }, []);

  async function enable() {
    setState("enabling");
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setState(permission === "denied" ? "denied" : "offer");
      return;
    }

    const registration = await navigator.serviceWorker.ready;
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) {
      setState("offer");
      return;
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });

    const json = subscription.toJSON();
    const response = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
    }).catch(() => null);

    setState(response?.ok ? "enabled" : "offer");
  }

  if (state === "checking" || state === "hidden" || state === "unsupported" || state === "enabled") return null;

  return (
    <div className="mb-3.5 rounded-input border border-ai-blue-border bg-ai-blue-light p-3.5">
      {state === "denied" ? (
        <p className="text-body text-ai-blue-text">
          Notifications are blocked for Autopilot in your browser settings. Enable them to get a reminder before each shift.
        </p>
      ) : (
        <>
          <p className="text-body text-ai-blue-text">Get a reminder 1 hour and 15 minutes before each shift, and when it starts.</p>
          <button
            type="button"
            onClick={enable}
            disabled={state === "enabling"}
            className="mt-2 rounded-btn bg-nhs-blue px-3.5 py-[7px] text-[12px] font-medium text-white disabled:opacity-50"
          >
            {state === "enabling" ? "Enabling…" : "Enable shift notifications"}
          </button>
        </>
      )}
    </div>
  );
}
