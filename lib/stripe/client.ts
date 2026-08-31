import "server-only";
import Stripe from "stripe";

// Server-side only — never import from a client component. Source: TRD
// section 10 (Stripe Integration), CLAUDE.md section 15 (STRIPE_SECRET_KEY
// server-side only). The `server-only` import makes this a build-time
// error instead of the runtime crash it was before: BillingPageClient.tsx
// originally imported TIER_DISPLAY from this same file, which pulled
// `new Stripe(process.env.STRIPE_SECRET_KEY!)` into the client bundle too
// — STRIPE_SECRET_KEY is undefined in the browser, so Stripe's
// constructor threw "Neither apiKey nor config.authenticator provided"
// and crashed the whole page. Client-safe display constants now live in
// lib/stripe/tiers.ts instead.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Source: TRD section 10.3 (Phase 1 plan tiers). Price IDs are per-org's
// Stripe test-mode products, created by Gokul directly in the Stripe
// dashboard and passed in via env — never hardcoded, since they differ
// between test and live mode and would otherwise need a code change to
// rotate.
export const TIER_PRICE_IDS: Record<"essential" | "growth" | "professional", string> = {
  essential: process.env.STRIPE_PRICE_ESSENTIAL!,
  growth: process.env.STRIPE_PRICE_GROWTH!,
  professional: process.env.STRIPE_PRICE_PROFESSIONAL!,
};

export const TIER_BY_PRICE_ID: Record<string, "essential" | "growth" | "professional"> = {
  [TIER_PRICE_IDS.essential]: "essential",
  [TIER_PRICE_IDS.growth]: "growth",
  [TIER_PRICE_IDS.professional]: "professional",
};
