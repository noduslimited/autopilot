import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/client";
import { TIER_DISPLAY } from "@/lib/stripe/tiers";
import { getActiveServiceUserCount } from "@/lib/billing/activeServiceUsers";
import { BillingPageClient } from "./BillingPageClient";

// Source: PRD section 4.10 (Billing — Plan & usage), section 12 (Pricing
// Model), TRD section 10 (Stripe Integration). Sessions.md Session 11
// step 9 ("Wire Plan & usage page to show live Supabase data").
export default async function BillingSettingsPage({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  const { checkout } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: managerRow } = await supabase.from("users").select("org_id").eq("id", user!.id).single();
  const { data: org } = await supabase
    .from("organisations")
    .select("status, stripe_plan_tier, stripe_customer_id, stripe_subscription_id, trial_end_date, billing_issue_started_at")
    .eq("id", managerRow!.org_id)
    .single();

  if (!org) return null;

  const activeUserCount = await getActiveServiceUserCount(supabase, managerRow!.org_id);
  const tier = org.stripe_plan_tier && org.stripe_plan_tier in TIER_DISPLAY ? TIER_DISPLAY[org.stripe_plan_tier as keyof typeof TIER_DISPLAY] : null;

  let nextBillingDate: string | null = null;
  if (org.status === "active" && org.stripe_subscription_id) {
    try {
      const subscription = await stripe.subscriptions.retrieve(org.stripe_subscription_id);
      // As of API version 2025-04-30.basil, current_period_end lives on
      // each subscription item, not the top-level Subscription object —
      // confirmed by inspecting a real subscription's raw API response
      // (the top-level field is simply absent/undefined now). Verified
      // against a real test-mode subscription before relying on this.
      const periodEnd = subscription.items.data[0]?.current_period_end;
      if (periodEnd) nextBillingDate = new Date(periodEnd * 1000).toISOString();
    } catch {
      // Stripe unreachable or subscription no longer exists — fall back
      // to showing no date rather than failing the whole page.
    }
  }

  const billingGraceDeadline =
    (org.status === "payment_failed" || org.status === "suspended") && org.billing_issue_started_at
      ? new Date(new Date(org.billing_issue_started_at).getTime() + 48 * 60 * 60 * 1000).toISOString()
      : null;

  return (
    <BillingPageClient
      status={org.status}
      currentTier={org.stripe_plan_tier as "essential" | "growth" | "professional" | null}
      currentTierDisplay={tier}
      activeUserCount={activeUserCount}
      trialEndDate={org.trial_end_date}
      nextBillingDate={nextBillingDate}
      hasStripeCustomer={!!org.stripe_customer_id}
      billingGraceDeadline={billingGraceDeadline}
      checkoutNotice={checkout === "success" ? "success" : checkout === "cancelled" ? "cancelled" : null}
    />
  );
}
