import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe, TIER_PRICE_IDS } from "@/lib/stripe/client";
import { getActiveServiceUserCount } from "@/lib/billing/activeServiceUsers";

// Source: TRD section 10 (Stripe Integration), Sessions.md Session 11
// step 4. Manager selects a plan from Settings → redirected to Stripe
// Checkout.
interface CheckoutBody {
  tier: "essential" | "growth" | "professional";
}

function isCheckoutBody(value: unknown): value is CheckoutBody {
  if (typeof value !== "object" || value === null) return false;
  const tier = (value as Record<string, unknown>).tier;
  return tier === "essential" || tier === "growth" || tier === "professional";
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  if (!isCheckoutBody(body)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: userRow } = await supabase.from("users").select("org_id, role").eq("id", user.id).single();
  if (!userRow || userRow.role !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: org } = await supabase
    .from("organisations")
    .select("id, name, email, stripe_customer_id")
    .eq("id", userRow.org_id)
    .single();
  if (!org) {
    return NextResponse.json({ error: "Organisation not found." }, { status: 404 });
  }

  // Get-or-create the Stripe customer, saving it immediately so every
  // subsequent webhook event for this org can be resolved by customer ID
  // (see /api/stripe/webhook — subscription events don't carry
  // client_reference_id, only checkout.session.* events do).
  let stripeCustomerId = org.stripe_customer_id;
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: org.email,
      name: org.name,
      metadata: { org_id: org.id },
    });
    stripeCustomerId = customer.id;
    await supabase.from("organisations").update({ stripe_customer_id: stripeCustomerId }).eq("id", org.id);
  }

  const quantity = Math.max(1, await getActiveServiceUserCount(supabase, org.id));
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  const session = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    mode: "subscription",
    line_items: [{ price: TIER_PRICE_IDS[body.tier], quantity }],
    success_url: `${appUrl}/settings/billing?checkout=success`,
    cancel_url: `${appUrl}/settings/billing?checkout=cancelled`,
    client_reference_id: org.id,
    subscription_data: { metadata: { org_id: org.id, tier: body.tier } },
  });

  if (!session.url) {
    return NextResponse.json({ error: "Could not create checkout session." }, { status: 500 });
  }

  return NextResponse.json({ url: session.url });
}
