// Client-safe plan display data — no env vars, no Stripe SDK. Deliberately
// separate from lib/stripe/client.ts (server-only) so client components
// like BillingPageClient.tsx can show pricing without pulling the Stripe
// SDK / secret key into the browser bundle.
export const TIER_DISPLAY: Record<"essential" | "growth" | "professional", { name: string; pricePerUser: number; userRange: string }> = {
  essential: { name: "Essential", pricePerUser: 9, userRange: "1–15 users" },
  growth: { name: "Growth", pricePerUser: 12, userRange: "16–50 users" },
  professional: { name: "Professional", pricePerUser: 14, userRange: "51–150 users" },
};
