import Link from "next/link";

// Deliberately a placeholder, not drafted content — Gokul asked that
// real Terms of Service text (which must incorporate the Data Processing
// Agreement obligations from the Security and Data Privacy Document
// section 2.3) not be authored by Claude Code, since it carries real
// legal/liability weight that a solicitor should review. This keeps the
// /terms link the registration flow already points to from being broken,
// without presenting AI-drafted text as finalised legal terms.
export const metadata = {
  title: "Terms of Service | Autopilot",
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-page-bg px-5 py-10">
      <div className="mx-auto max-w-[720px]">
        <Link href="/login" className="text-secondary text-nhs-blue">
          ← Back to sign in
        </Link>

        <div className="mt-4 rounded-card border border-border-default bg-card-bg p-8">
          <h1 className="text-page-heading text-text-primary">Terms of Service</h1>

          <div className="mt-4 rounded-input border border-amber-text/20 bg-amber-light px-4 py-3 text-body text-amber-text">
            Our full Terms of Service — including the Data Processing Agreement covering how
            Nodus Limited processes data on your organisation&apos;s behalf — is currently being
            finalised with legal review. This page will be updated with the complete terms before
            Autopilot is made available to paying customers.
          </div>

          <p className="mt-4 text-body text-text-primary">
            In the meantime, for any questions about how your organisation&apos;s data is
            processed, see our{" "}
            <Link href="/privacy" className="text-nhs-blue">
              Privacy Policy
            </Link>
            , or contact us directly at{" "}
            <a href="mailto:support@noduslimited.co.uk" className="text-nhs-blue">
              support@noduslimited.co.uk
            </a>
            .
          </p>
        </div>

        <p className="mt-4 text-center text-tiny text-text-secondary">
          Autopilot is a product of Nodus Limited. noduslimited.co.uk
        </p>
      </div>
    </div>
  );
}
