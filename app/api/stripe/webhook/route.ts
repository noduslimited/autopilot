import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe, TIER_BY_PRICE_ID } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/resend/client";

// Source: TRD section 10, Sessions.md Session 11 step 5. No user session
// exists on an incoming Stripe webhook call — always the admin client.
// Raw body (not parsed JSON) is required for signature verification, so
// this reads request.text(), not request.json().
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (error) {
    console.error("Stripe webhook signature verification failed:", error);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  const admin = createAdminClient();

  async function resolveOrgIdByCustomer(customerId: string | Stripe.Customer | Stripe.DeletedCustomer | null): Promise<string | null> {
    if (!customerId) return null;
    const id = typeof customerId === "string" ? customerId : customerId.id;
    const { data: org } = await admin.from("organisations").select("id").eq("stripe_customer_id", id).maybeSingle();
    return org?.id ?? null;
  }

  // Source: Gokul, direct request (2026-08-31) — payment_failed/suspended
  // orgs get a 48-hour grace period (enforced in proxy.ts) from the
  // moment the billing issue actually began, not from whenever the
  // middleware happens to check. billing_issue_started_at is set once,
  // on the first transition into either status, and never overwritten by
  // a second failure while already in that state — otherwise a retried
  // and re-failed payment would keep pushing the deadline out forever.
  async function setBillingStatus(orgId: string, status: "active" | "payment_failed" | "suspended"): Promise<void> {
    if (status === "active") {
      await admin.from("organisations").update({ status: "active", billing_issue_started_at: null }).eq("id", orgId);
      return;
    }

    const { data: org } = await admin.from("organisations").select("billing_issue_started_at").eq("id", orgId).single();
    await admin
      .from("organisations")
      .update({ status, billing_issue_started_at: org?.billing_issue_started_at ?? new Date().toISOString() })
      .eq("id", orgId);
  }

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const orgId = (subscription.metadata?.org_id as string | undefined) ?? (await resolveOrgIdByCustomer(subscription.customer));
      if (!orgId) {
        console.error("Stripe webhook: could not resolve org for subscription", subscription.id);
        break;
      }

      const priceId = subscription.items.data[0]?.price.id;
      const tier = priceId ? TIER_BY_PRICE_ID[priceId] : undefined;

      if (subscription.status === "active" || subscription.status === "trialing") {
        await setBillingStatus(orgId, "active");
        await admin
          .from("organisations")
          .update({
            stripe_subscription_id: subscription.id,
            ...(tier ? { stripe_plan_tier: tier } : {}),
          })
          .eq("id", orgId);
      } else if (subscription.status === "past_due" || subscription.status === "unpaid") {
        await setBillingStatus(orgId, "payment_failed");
      } else if (subscription.status === "canceled") {
        await setBillingStatus(orgId, "suspended");
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const orgId = (subscription.metadata?.org_id as string | undefined) ?? (await resolveOrgIdByCustomer(subscription.customer));
      if (!orgId) {
        console.error("Stripe webhook: could not resolve org for cancelled subscription", subscription.id);
        break;
      }
      await setBillingStatus(orgId, "suspended");
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer;
      const orgId = await resolveOrgIdByCustomer(customerId);
      if (!orgId) {
        console.error("Stripe webhook: could not resolve org for failed invoice", invoice.id);
        break;
      }

      const { data: orgBefore } = await admin.from("organisations").select("name, email").eq("id", orgId).single();
      await setBillingStatus(orgId, "payment_failed");
      const { data: orgAfter } = await admin.from("organisations").select("billing_issue_started_at").eq("id", orgId).single();

      if (orgBefore && orgAfter?.billing_issue_started_at) {
        const deadline = new Date(new Date(orgAfter.billing_issue_started_at).getTime() + 48 * 60 * 60 * 1000);
        const deadlineText = deadline.toLocaleString("en-GB", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
        await sendEmail({
          to: orgBefore.email,
          subject: "Autopilot — payment failed",
          html: `<p>Hi,</p><p>We were unable to process your latest payment for Autopilot. Please update your payment method by <strong>${deadlineText}</strong> (48 hours from now) to avoid your account being restricted.</p><p>You can update your payment details in Autopilot under Settings → Plan &amp; usage.</p><p>Thank you,<br/>The Autopilot team</p>`,
        });
      }
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
