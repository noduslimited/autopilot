import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/client";

// Source: Sessions.md Session 11 step 10 — "Add Stripe Customer Portal
// link to billing page" ("manager can update payment method").
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: userRow } = await supabase.from("users").select("org_id, role").eq("id", user.id).single();
  if (!userRow || userRow.role !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: org } = await supabase.from("organisations").select("stripe_customer_id").eq("id", userRow.org_id).single();
  if (!org?.stripe_customer_id) {
    return NextResponse.json({ error: "No billing account found yet. Select a plan first." }, { status: 400 });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: org.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing`,
  });

  return NextResponse.json({ url: session.url });
}
