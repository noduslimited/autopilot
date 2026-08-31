import { UNLINKED_ACCOUNT_MESSAGE } from "@/lib/family/getLinkedClient";

export function UnlinkedAccountNotice() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <i className="ti ti-lock text-[32px] text-text-secondary" aria-hidden="true" />
      <p className="mt-3 text-body text-text-secondary">{UNLINKED_ACCOUNT_MESSAGE}</p>
    </div>
  );
}
