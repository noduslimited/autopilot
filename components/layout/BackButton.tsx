"use client";

import { useRouter } from "next/navigation";

// Source: Gokul, direct request 2026-09-03 — "back button... should
// navigate to the previous page in the browser history." Deliberately
// router.back() rather than a fixed href, per that instruction — distinct
// from the carer/family Header component's existing back-arrow variant,
// which intentionally uses a fixed destination (e.g. Visit Detail always
// returns to /my-day regardless of history) and is left as-is here since
// that's a safer, already-correct pattern, not a gap.
export function BackButton({ className = "" }: { className?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.back()}
      aria-label="Back"
      className={["inline-flex items-center", className].join(" ")}
    >
      <i className="ti ti-arrow-left text-[20px]" aria-hidden="true" />
    </button>
  );
}
