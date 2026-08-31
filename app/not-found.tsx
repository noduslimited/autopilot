import Link from "next/link";

// No mockup exists for a 404 screen (same gap as Session 2's reset-password
// pages) — built from the auth-card visual language for consistency. This is
// a root-level app/not-found.tsx, so it renders standalone within the root
// layout only, not any route group's own layout — styled self-contained here
// rather than depending on (auth)/layout.tsx's centring wrapper.
export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-page-bg px-5 py-10">
      <div className="w-full max-w-[400px] rounded-card border border-border-default bg-card-bg px-6 py-8 text-center">
        <div className="text-page-heading text-nhs-dark-blue">Autopilot</div>
        <div className="mt-0.5 text-[10px] font-normal uppercase tracking-[2px] text-nhs-light-blue">
          Nodus Limited
        </div>
        <p className="mt-6 text-[40px] font-bold leading-none text-nhs-blue">404</p>
        <h1 className="mt-2 text-page-heading text-text-primary">Page not found</h1>
        <p className="mt-2 text-body text-text-secondary">
          The page you&apos;re looking for doesn&apos;t exist or may have moved.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex items-center justify-center rounded-btn bg-nhs-blue px-3.5 py-[9px] text-[13px] font-medium text-white hover:bg-[#004A93]"
        >
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
