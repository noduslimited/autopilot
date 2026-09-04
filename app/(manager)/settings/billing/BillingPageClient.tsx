"use client";

import { useEffect, useState } from "react";
import { TIER_DISPLAY } from "@/lib/stripe/tiers";
import { useToast } from "@/components/ui/Toast";

type Tier = "essential" | "growth" | "professional";

interface BillingPageClientProps {
  status: string;
  currentTier: Tier | null;
  currentTierDisplay: { name: string; pricePerUser: number; userRange: string } | null;
  activeUserCount: number;
  trialEndDate: string | null;
  nextBillingDate: string | null;
  hasStripeCustomer: boolean;
  billingGraceDeadline: string | null;
  checkoutNotice: "success" | "cancelled" | null;
}

function formatDeadline(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}

const TIER_ORDER: Tier[] = ["essential", "growth", "professional"];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export function BillingPageClient({
  status,
  currentTier,
  currentTierDisplay,
  activeUserCount,
  trialEndDate,
  nextBillingDate,
  hasStripeCustomer,
  billingGraceDeadline,
  checkoutNotice,
}: BillingPageClientProps) {
  const [loadingTier, setLoadingTier] = useState<Tier | null>(null);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [recommendation, setRecommendation] = useState<string | null>(null);
  const { showToast } = useToast();

  const needsPlan = status === "trial" || status === "trial_expired" || status === "suspended";
  const gracePeriodPassed = !!billingGraceDeadline && new Date(billingGraceDeadline).getTime() < Date.now();
  const isPaymentFailed = status === "payment_failed";
  const nextTier: Tier | null = currentTier && TIER_ORDER.indexOf(currentTier) < TIER_ORDER.length - 1 ? TIER_ORDER[TIER_ORDER.indexOf(currentTier) + 1] : null;

  useEffect(() => {
    if (!currentTier) return;
    let cancelled = false;
    fetch("/api/ai/billing-recommendation", { method: "POST" })
      .then((response) => (response.ok ? response.json() : { text: null }))
      .then((data: { text: string | null }) => {
        if (!cancelled) setRecommendation(data.text);
      })
      .catch(() => {
        if (!cancelled) setRecommendation(null);
      });
    return () => {
      cancelled = true;
    };
  }, [currentTier]);

  async function selectTier(tier: Tier) {
    setLoadingTier(tier);
    const response = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier }),
    }).catch(() => null);
    const data = await response?.json().catch(() => null);
    if (!response?.ok || !data?.url) {
      setLoadingTier(null);
      showToast("Could not start checkout. Please try again.", "error");
      return;
    }
    window.location.href = data.url;
  }

  async function openPortal() {
    setLoadingPortal(true);
    const response = await fetch("/api/stripe/portal", { method: "POST" }).catch(() => null);
    const data = await response?.json().catch(() => null);
    setLoadingPortal(false);
    if (!response?.ok || !data?.url) {
      showToast(data?.error ?? "Could not open the billing portal.", "error");
      return;
    }
    window.location.href = data.url;
  }

  return (
    <div className="rounded-card border border-border-default bg-card-bg py-4 px-5">
      <h1 className="text-page-heading text-text-primary">Plan & usage</h1>

      {checkoutNotice === "success" ? (
        <div className="mt-3 rounded-input border border-success-green-text/20 bg-success-green-light px-4 py-2.5 text-body text-success-green-text">
          Payment successful — your plan is now active.
        </div>
      ) : null}
      {checkoutNotice === "cancelled" ? (
        <div className="mt-3 rounded-input border border-amber-text/20 bg-amber-light px-4 py-2.5 text-body text-amber-text">Checkout cancelled — no changes were made.</div>
      ) : null}
      {isPaymentFailed ? (
        <div className="mt-3 rounded-input border border-nhs-red/20 bg-[#FDECEA] px-4 py-2.5 text-body text-danger-red">
          {gracePeriodPassed ? (
            "Your account has been restricted after a failed payment. Update your payment method below to restore access."
          ) : billingGraceDeadline ? (
            <>
              Your last payment failed. Please update your payment method by <strong>{formatDeadline(billingGraceDeadline)}</strong> to avoid your account being restricted.
            </>
          ) : (
            "Your last payment failed. Please update your payment method to avoid interruption to your service."
          )}
        </div>
      ) : null}
      {status === "suspended" && billingGraceDeadline ? (
        <div className="mt-3 rounded-input border border-nhs-red/20 bg-[#FDECEA] px-4 py-2.5 text-body text-danger-red">
          {gracePeriodPassed ? (
            "Your account has been restricted since your subscription ended. Select a plan below to restore access."
          ) : (
            <>
              Your subscription has ended. Select a plan below by <strong>{formatDeadline(billingGraceDeadline)}</strong> to avoid your account being restricted.
            </>
          )}
        </div>
      ) : null}

      {recommendation ? (
        <div className="mt-3 rounded-[10px] border border-ai-blue-border bg-ai-blue-light py-2.5 px-3.5">
          <p className="flex items-start gap-1.5 text-body text-ai-blue-text">
            <i className="ti ti-sparkles mt-0.5 shrink-0 text-[14px] text-nhs-blue" aria-hidden="true" />
            {recommendation}
          </p>
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-input border border-border-default p-3.5">
          <p className="text-label text-text-secondary">Current plan</p>
          <p className="mt-1 text-body font-medium text-text-primary">
            {status === "trial" ? "Free Trial" : (currentTierDisplay?.name ?? "No active plan")}
          </p>
        </div>
        <div className="rounded-input border border-border-default p-3.5">
          <p className="text-label text-text-secondary">Active service users</p>
          <p className="mt-1 text-body font-medium text-text-primary">{activeUserCount}</p>
        </div>
        <div className="rounded-input border border-border-default p-3.5">
          <p className="text-label text-text-secondary">{status === "trial" ? "Trial ends" : "Next billing date"}</p>
          <p className="mt-1 text-body font-medium text-text-primary">
            {status === "trial" && trialEndDate ? formatDate(trialEndDate) : nextBillingDate ? formatDate(nextBillingDate) : "—"}
          </p>
        </div>
        <div className="rounded-input border border-border-default p-3.5">
          <p className="text-label text-text-secondary">Payment method</p>
          <p className="mt-1 text-body font-medium text-text-primary">{hasStripeCustomer ? "On file with Stripe" : "No card on file"}</p>
          {hasStripeCustomer ? (
            <button type="button" onClick={openPortal} disabled={loadingPortal} className="mt-1 text-secondary text-nhs-blue disabled:opacity-50">
              {loadingPortal ? "Opening…" : "Update payment method"}
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-5 border-t border-border-default pt-4">
        <h2 className="mb-3 text-section-heading text-text-primary">{needsPlan ? "Choose a plan" : "Compare plans"}</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {TIER_ORDER.map((tier) => {
            const display = TIER_DISPLAY[tier];
            const isCurrent = !needsPlan && tier === currentTier;
            return (
              <div
                key={tier}
                className={["flex flex-col rounded-card border p-4", isCurrent ? "border-nhs-blue bg-ai-blue-light" : "border-border-default"].join(" ")}
              >
                <div className="flex items-center justify-between">
                  <p className="text-body font-medium text-text-primary">{display.name}</p>
                  {isCurrent ? <span className="rounded-[20px] bg-nhs-blue px-2 py-0.5 text-[10px] font-medium text-white">Current plan</span> : null}
                </div>
                <p className="mt-1 text-[20px] font-bold text-text-primary">
                  £{display.pricePerUser}
                  <span className="text-secondary font-normal text-text-secondary">/user/mo</span>
                </p>
                <p className="mt-0.5 text-secondary text-text-secondary">{display.userRange}</p>
                {needsPlan ? (
                  <button
                    type="button"
                    onClick={() => selectTier(tier)}
                    disabled={loadingTier !== null}
                    className="mt-3 rounded-btn bg-nhs-blue py-[9px] text-[13px] font-medium text-white disabled:opacity-50"
                  >
                    {loadingTier === tier ? "Redirecting…" : "Select plan"}
                  </button>
                ) : isCurrent ? null : (
                  <button
                    type="button"
                    onClick={openPortal}
                    disabled={loadingPortal}
                    className="mt-3 rounded-btn border border-nhs-blue py-[9px] text-[13px] font-medium text-nhs-blue disabled:opacity-50"
                  >
                    {loadingPortal ? "Opening…" : tier === nextTier ? `Upgrade to ${display.name}` : `Switch to ${display.name}`}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {!needsPlan ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border-default pt-4">
          <button
            type="button"
            onClick={openPortal}
            disabled={loadingPortal}
            className="inline-block rounded-btn bg-nhs-blue px-3.5 py-[7px] text-[12px] font-medium text-white disabled:opacity-50"
          >
            {loadingPortal ? "Opening…" : "Manage billing"}
          </button>
          {nextTier ? (
            <button
              type="button"
              onClick={openPortal}
              disabled={loadingPortal}
              className="inline-flex items-center gap-1 rounded-btn border border-nhs-blue px-3.5 py-[7px] text-[12px] font-medium text-nhs-blue disabled:opacity-50"
            >
              Upgrade to {TIER_DISPLAY[nextTier].name} — £{TIER_DISPLAY[nextTier].pricePerUser}/user/mo
              <i className="ti ti-arrow-right text-[12px]" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
