"use client";

import { useEffect, useState } from "react";
import { AiSummaryCard, type AiSummaryAction } from "@/components/ai/AiSummaryCard";

export interface AiSummarySectionProps {
  hasOpenIncidents: boolean;
  hasStaffingGap: boolean;
}

// Source: PRD section 4.2 (AI summary card), AI Feature Specification
// section 4.5. Graceful degradation is mandatory (CLAUDE.md rule 9): any
// failure hides this section entirely — no error shown to the manager.
// Action buttons are context-sensitive and derived from real dashboard
// data, not from the AI's output — Data Flow & Architecture Diagram
// section 7.2: "Action buttons derived from context (not from AI
// output) — hardcoded logic."
export function AiSummarySection({ hasOpenIncidents, hasStaffingGap }: AiSummarySectionProps) {
  const [summary, setSummary] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/ai/summary", { method: "POST" })
      .then((response) => (response.ok ? response.json() : { summary: null }))
      .then((data: { summary: string | null }) => {
        if (!cancelled) setSummary(data.summary);
      })
      .catch(() => {
        if (!cancelled) setSummary(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!summary) return null;

  const actions: AiSummaryAction[] = [];
  if (hasOpenIncidents) actions.push({ label: "View incidents", href: "/incidents" });
  if (hasStaffingGap) actions.push({ label: "Assign cover", href: "/rota" });

  return <AiSummaryCard summary={summary} actions={actions} />;
}
