import { Suspense } from "react";
import { OrgRegisterForm } from "./OrgRegisterForm";
import { InvitationAcceptForm } from "./InvitationAcceptForm";

// IA doc section 6: /register is new-organisation registration;
// /register?token=[token] is staff or NOK invitation acceptance.
export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (token) {
    // InvitationAcceptForm reads useSearchParams() — requires a Suspense
    // boundary for static prerendering.
    return (
      <Suspense fallback={null}>
        <InvitationAcceptForm token={token} />
      </Suspense>
    );
  }

  return <OrgRegisterForm />;
}
