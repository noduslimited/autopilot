"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Shown only on mobile (lg:hidden, see SettingsLayout), and only on a
// settings sub-page — not on bare /settings itself, which is already the
// category list this links back to.
export function MobileSettingsBackBar() {
  const pathname = usePathname();
  if (pathname === "/settings") return null;

  return (
    <Link href="/settings" className="mb-3 inline-flex items-center gap-1 text-secondary text-nhs-blue lg:hidden">
      <i className="ti ti-arrow-left text-[14px]" aria-hidden="true" />
      Back to Settings
    </Link>
  );
}
