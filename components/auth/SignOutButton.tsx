"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Shared across all three portals — no logout mechanism existed anywhere
// in the app before this (found while building the carer profile page).
export interface SignOutButtonProps {
  className?: string;
  iconOnly?: boolean;
}

export function SignOutButton({ className = "", iconOnly = false }: SignOutButtonProps) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <button type="button" onClick={handleSignOut} disabled={signingOut} aria-label="Sign out" className={`${className} disabled:opacity-50`}>
      {iconOnly ? <i className={`ti ${signingOut ? "ti-loader-2" : "ti-logout"} text-[16px]`} aria-hidden="true" /> : signingOut ? "Signing out…" : "Sign out"}
    </button>
  );
}
