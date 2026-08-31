"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Textarea } from "@/components/ui/Input";
import { AiDraftButton } from "@/components/ai/AiDraftButton";

// Source: PRD section 5.5 (Report Incident)

export interface IncidentClientOption {
  id: string;
  first_name: string;
  last_name: string;
}

interface CurrentVisit {
  visitId: string;
  clientId: string;
}

const INCIDENT_TYPES: Array<{ value: string; label: string; icon: string }> = [
  { value: "fall", label: "Fall", icon: "run" },
  { value: "medication", label: "Medication", icon: "pill" },
  { value: "behaviour", label: "Behaviour", icon: "mood-sad" },
  { value: "other", label: "Other", icon: "dots" },
];

const SEVERITIES: Array<{ value: string; label: string; activeClass: string }> = [
  { value: "low", label: "Low", activeClass: "border-nhs-green bg-success-green-light text-success-green-text" },
  { value: "medium", label: "Medium", activeClass: "border-nhs-amber bg-amber-light text-amber-text" },
  { value: "high", label: "High", activeClass: "border-nhs-red bg-[#FDECEA] text-danger-red" },
];

export function ReportIncidentClient({ clients, currentVisit }: { clients: IncidentClientOption[]; currentVisit: CurrentVisit | null }) {
  const router = useRouter();
  const [clientId, setClientId] = useState(currentVisit?.clientId ?? "");
  const [incidentType, setIncidentType] = useState<string | null>(null);
  const [severity, setSeverity] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [gpContacted, setGpContacted] = useState<boolean | null>(null);
  const [gpNotes, setGpNotes] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [draftUnavailable, setDraftUnavailable] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const selectedClient = clients.find((c) => c.id === clientId);
  const isCurrentVisit = currentVisit?.clientId === clientId;

  async function draftDescription() {
    if (!clientId || !incidentType || !severity) {
      setError("Select a client, incident type, and severity first.");
      return;
    }
    setDrafting(true);
    setDraftUnavailable(false);
    setError(null);
    const response = await fetch("/api/ai/draft-incident", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, incidentType, severity, gpContacted: !!gpContacted, gpNotes: gpNotes || null, existingDescription: description || null }),
    }).catch(() => null);
    setDrafting(false);
    const data = await response?.json().catch(() => null);
    if (!response?.ok || !data?.draft) {
      setDraftUnavailable(true);
      return;
    }
    setDescription(data.draft);
  }

  async function handleSubmit() {
    if (!clientId || !incidentType || !severity || !description.trim() || gpContacted === null) {
      setError("Please complete all required fields before submitting.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const response = await fetch("/api/report-incident", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId,
        visitId: isCurrentVisit ? currentVisit!.visitId : null,
        incidentType,
        severity,
        description: description.trim(),
        gpContacted,
        gpNotes: gpContacted ? gpNotes.trim() || null : null,
      }),
    }).catch(() => null);
    setSubmitting(false);
    const data = await response?.json().catch(() => null);
    if (!response?.ok || !data?.incidentRef) {
      setError("Could not submit this incident report. Please try again.");
      return;
    }
    setConfirmation(data.incidentRef);
  }

  if (confirmation) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <i className="ti ti-circle-check text-[48px] text-nhs-green" aria-hidden="true" />
        <p className="mt-4 text-[16px] font-bold text-text-primary">Incident reported.</p>
        <p className="mt-1 text-body text-text-secondary">
          Ref: {confirmation}. Your manager has been notified.
        </p>
        <button
          type="button"
          onClick={() => router.push("/my-day")}
          className="mt-5 w-full max-w-[280px] rounded-btn bg-nhs-blue py-[10px] text-[14px] font-medium text-white"
        >
          Back to My Day
        </button>
      </div>
    );
  }

  return (
    <div>
      <header className="bg-nhs-red px-4 pt-5 pb-4 text-white">
        <button type="button" onClick={() => router.push("/my-day")} className="mb-2 inline-flex text-white/80" aria-label="Back">
          <i className="ti ti-arrow-left text-[20px]" aria-hidden="true" />
        </button>
        <h1 className="text-[16px] font-bold text-white">Report incident</h1>
        <p className="mt-1 text-secondary text-white/90">Complete this form as soon as possible. Your manager will be notified immediately.</p>
      </header>

      <div className="px-4 py-4">
        <div className="mb-3.5">
          <p className="mb-1 text-label text-text-secondary">Client involved *</p>
          <select
            value={clientId}
            onChange={(event) => setClientId(event.target.value)}
            className="w-full rounded-input border border-border-default px-3 py-[9px] text-body"
          >
            <option value="">Select client…</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.first_name} {client.last_name}
                {currentVisit?.clientId === client.id ? " — current visit" : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-3.5">
          <p className="mb-1 text-label text-text-secondary">Incident type *</p>
          <div className="grid grid-cols-2 gap-2">
            {INCIDENT_TYPES.map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => setIncidentType(type.value)}
                className={[
                  "flex items-center justify-center gap-1.5 rounded-input border py-3 text-[13px] font-medium",
                  incidentType === type.value ? "border-nhs-red bg-[#FDECEA] text-danger-red" : "border-border-default bg-card-bg text-text-primary",
                ].join(" ")}
              >
                <i className={`ti ti-${type.icon} text-[16px]`} aria-hidden="true" />
                {type.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-3.5">
          <p className="mb-1 text-label text-text-secondary">Severity *</p>
          <div className="grid grid-cols-3 gap-2">
            {SEVERITIES.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setSeverity(option.value)}
                className={[
                  "rounded-input border py-2.5 text-[13px] font-medium",
                  severity === option.value ? option.activeClass : "border-border-default bg-card-bg text-text-primary",
                ].join(" ")}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-3.5">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-label text-text-secondary">What happened? *</p>
          </div>
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Describe what happened, when, and what action you took…"
            rows={5}
          />
          <div className="mt-1.5">
            <AiDraftButton
              label={description.trim() ? "Reword with AI" : "AI draft"}
              loading={drafting}
              disabledReason={draftUnavailable ? "AI drafting temporarily unavailable" : undefined}
              onClick={draftDescription}
            />
          </div>
        </div>

        <div className="mb-3.5">
          <p className="mb-1 text-label text-text-secondary">Was a GP or emergency service contacted? *</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setGpContacted(true)}
              className={["rounded-input border py-2.5 text-[13px] font-medium", gpContacted === true ? "border-nhs-blue bg-ai-blue-light text-ai-blue-heading" : "border-border-default bg-card-bg text-text-primary"].join(" ")}
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => setGpContacted(false)}
              className={["rounded-input border py-2.5 text-[13px] font-medium", gpContacted === false ? "border-nhs-blue bg-ai-blue-light text-ai-blue-heading" : "border-border-default bg-card-bg text-text-primary"].join(" ")}
            >
              No
            </button>
          </div>
        </div>

        {gpContacted ? (
          <div className="mb-3.5">
            <p className="mb-1 text-label text-text-secondary">Who was contacted and what was advised?</p>
            <Textarea value={gpNotes} onChange={(event) => setGpNotes(event.target.value)} rows={3} placeholder="e.g. Called GP surgery — advised to monitor for 24 hours…" />
          </div>
        ) : null}

        {error ? <p className="mb-3 text-secondary text-nhs-red">{error}</p> : null}

        <button
          type="button"
          disabled={submitting}
          onClick={handleSubmit}
          className="w-full rounded-btn bg-nhs-red py-[11px] text-[14px] font-medium text-white disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit incident report"}
        </button>
        <p className="mt-2 text-center text-secondary text-text-secondary">Your manager will be notified immediately</p>
      </div>
    </div>
  );
}
