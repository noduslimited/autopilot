import { createClient } from "@/lib/supabase/server";

// Source: PRD section 4.10 (Organisation — Branding)
export default async function BrandingSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: managerRow } = await supabase.from("users").select("org_id").eq("id", user!.id).single();
  const { data: org } = await supabase.from("organisations").select("org_code, logo_url").eq("id", managerRow!.org_id).single();

  if (!org) return null;

  return (
    <div className="rounded-card border border-border-default bg-card-bg py-4 px-5">
      <h1 className="text-page-heading text-text-primary">Branding</h1>

      <div className="mt-4 flex items-center gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-input border border-dashed border-border-default bg-page-bg text-secondary text-text-muted">
          {org.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={org.logo_url} alt="Organisation logo" className="h-full w-full object-cover" />
          ) : (
            "Logo"
          )}
        </div>
        <p className="text-secondary text-text-secondary">
          Logo can be changed from <span className="text-text-primary">Organisation → Profile</span>.
        </p>
      </div>

      <div className="mt-5 space-y-1">
        <p className="text-label text-text-secondary">Organisation code</p>
        <p className="text-body text-text-primary">
          <span className="font-mono font-medium text-nhs-blue">{org.org_code}</span>{" "}
          <span className="text-secondary text-text-muted">(cannot be changed)</span>
        </p>
      </div>

      <div className="mt-4 space-y-1">
        <p className="text-label text-text-secondary">Example ID preview</p>
        <p className="font-mono text-body font-medium text-nhs-blue">{org.org_code}-CLT-EXA-MPL-001</p>
      </div>
    </div>
  );
}
