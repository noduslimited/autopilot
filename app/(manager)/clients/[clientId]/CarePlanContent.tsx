"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { AiDraftButton } from "@/components/ai/AiDraftButton";

interface ClientRiskFields {
  biography: string | null;
  allergies: string[];
  dietary_requirements: string | null;
  dnacpr: boolean;
  risk_level: string;
  mobility_aids: string | null;
  falls_risk: boolean;
  choking_risk: boolean;
  additional_risk_notes: string | null;
}

const CARE_NEED_ICONS: Record<string, string> = {
  meal_prep: "tool-kitchen-2",
  medication: "pill",
  moving: "activity",
  personal_care: "droplet",
  companionship: "heart-off",
  housekeeping: "home",
  other: "dots",
};

const CARE_NEED_LABELS: Record<string, string> = {
  meal_prep: "Meal preparation",
  medication: "Medication administration",
  moving: "Moving and handling",
  personal_care: "Personal care",
  companionship: "Companionship",
  housekeeping: "Housekeeping",
  other: "Other",
};

export interface CareNeedDetail {
  type: string;
  detail: string;
}

export interface CarePlanContentProps {
  clientId: string;
  clientFirstName: string;
  client: ClientRiskFields;
  whatWeHelpWith: string[];
  careNeedDetails: CareNeedDetail[];
  lastReviewedAt: string | null;
  reviewerName: string | null;
  savedAiSuggestion: string | null;
}

export function CarePlanContent({
  clientId,
  clientFirstName,
  client,
  whatWeHelpWith,
  careNeedDetails,
  lastReviewedAt,
  reviewerName,
  savedAiSuggestion,
}: CarePlanContentProps) {
  const detailByType = new Map(careNeedDetails.map((n) => [n.type, n.detail]));
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiDraft, setAiDraft] = useState<string | null>(null);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiUnavailable, setAiUnavailable] = useState(false);
  const [form, setForm] = useState({
    biography: client.biography ?? "",
    allergiesText: client.allergies.join(", "),
    dietaryRequirements: client.dietary_requirements ?? "",
    dnacpr: client.dnacpr,
    riskLevel: client.risk_level,
    mobilityAids: client.mobility_aids ?? "",
    fallsRisk: client.falls_risk,
    chokingRisk: client.choking_risk,
    additionalRiskNotes: client.additional_risk_notes ?? "",
  });

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    await supabase
      .from("clients")
      .update({
        biography: form.biography.trim() || null,
        allergies: form.allergiesText.split(",").map((a) => a.trim()).filter(Boolean),
        dietary_requirements: form.dietaryRequirements.trim() || null,
        dnacpr: form.dnacpr,
        risk_level: form.riskLevel,
        mobility_aids: form.mobilityAids.trim() || null,
        falls_risk: form.fallsRisk,
        choking_risk: form.chokingRisk,
        additional_risk_notes: form.additionalRiskNotes.trim() || null,
      })
      .eq("id", clientId);

    // CLT-05: "On save: ... last reviewed date set to today, reviewer name set to current manager."
    await supabase
      .from("care_plans")
      .update({ last_reviewed_at: new Date().toISOString(), reviewed_by: user!.id })
      .eq("client_id", clientId);

    setSaving(false);
    setEditOpen(false);
    router.refresh();
  }

  // AI-03/AI-04: request a draft, show it editable, save on confirm.
  // Graceful degradation — CLAUDE.md rule 9: hide/disable, no error shown.
  async function handleRequestAiDraft() {
    setAiLoading(true);
    setAiUnavailable(false);

    const response = await fetch("/api/ai/draft-care-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId }),
    }).catch(() => null);

    const data: { draft?: string | null } = response && response.ok ? await response.json() : { draft: null };

    setAiLoading(false);
    if (data.draft) {
      setAiDraft(data.draft);
    } else {
      setAiUnavailable(true);
    }
  }

  async function handleSaveAiDraft() {
    if (!aiDraft) return;
    setAiSaving(true);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // AI-04: "care plan last reviewed date updated, audit log entry
    // created" — the log_audit trigger on care_plans covers the audit
    // entry automatically for this UPDATE.
    await supabase
      .from("care_plans")
      .update({ ai_suggested_updates: aiDraft, last_reviewed_at: new Date().toISOString(), reviewed_by: user!.id })
      .eq("client_id", clientId);

    setAiSaving(false);
    setAiDraft(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-subsection-heading text-text-primary">About {clientFirstName}</h2>
        <div className="flex gap-2">
          <AiDraftButton
            label="AI update suggestion"
            loading={aiLoading}
            onClick={handleRequestAiDraft}
            disabledReason={aiUnavailable ? "AI drafting temporarily unavailable" : undefined}
          />
          <Button variant="secondary" onClick={() => setEditOpen(true)}>
            Edit care plan
          </Button>
        </div>
      </div>

      <div className="rounded-card border border-border-default bg-card-bg py-3.5 px-4">
        <p className="text-body text-text-primary">{client.biography || "No biography recorded yet."}</p>
      </div>

      <div className="rounded-card border border-border-default bg-card-bg py-3.5 px-4">
        <h3 className="text-subsection-heading text-text-primary">What we help with</h3>
        {whatWeHelpWith.length === 0 ? (
          <p className="mt-2 text-body text-text-secondary">No care needs recorded yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {whatWeHelpWith.map((need) => {
              const detail = detailByType.get(need);
              return (
                <li key={need} className="flex items-start gap-2 text-body text-text-primary">
                  <i className={`ti ti-${CARE_NEED_ICONS[need] ?? "dots"} mt-0.5 text-[16px] text-nhs-blue`} aria-hidden="true" />
                  <span>
                    {CARE_NEED_LABELS[need] ?? need}
                    {detail ? <span className="block text-secondary text-text-secondary">{detail}</span> : null}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        {client.allergies.length > 0 ? (
          <div className="flex items-start gap-2 rounded-card bg-danger-red-light py-2.5 px-3.5 text-danger-red">
            <i className="ti ti-alert-circle mt-0.5 text-[16px]" aria-hidden="true" />
            <span className="text-body">Allergies: {client.allergies.join(", ")}</span>
          </div>
        ) : null}
        {client.risk_level === "high" ? (
          <div className="flex items-start gap-2 rounded-card bg-amber-light py-2.5 px-3.5 text-amber-text">
            <i className="ti ti-alert-triangle mt-0.5 text-[16px]" aria-hidden="true" />
            <span className="text-body">High risk client{client.additional_risk_notes ? ` — ${client.additional_risk_notes}` : ""}</span>
          </div>
        ) : null}
        {client.dnacpr ? (
          <div className="flex items-start gap-2 rounded-card bg-dnacpr-purple-light py-2.5 px-3.5 text-dnacpr-purple-text">
            <i className="ti ti-heart-off mt-0.5 text-[16px]" aria-hidden="true" />
            <span className="text-body">DNACPR in place</span>
          </div>
        ) : null}
      </div>

      <p className="text-secondary text-text-secondary">
        {lastReviewedAt
          ? `Last reviewed ${new Date(lastReviewedAt).toLocaleDateString("en-GB")}${reviewerName ? ` by ${reviewerName}` : ""}`
          : "Not yet reviewed"}
      </p>

      {savedAiSuggestion ? (
        <div className="rounded-[10px] border border-ai-blue-border bg-ai-blue-light py-3 px-3.5">
          <div className="flex items-center gap-2">
            <i className="ti ti-sparkles text-[14px] text-nhs-blue" aria-hidden="true" />
            <span className="text-label font-medium text-ai-blue-heading">AI update suggestion</span>
          </div>
          <p className="mt-1.5 whitespace-pre-line text-body text-ai-blue-text">{savedAiSuggestion}</p>
        </div>
      ) : null}

      <Modal open={editOpen} onClose={() => setEditOpen(false)}>
        <form onSubmit={handleSave} className="space-y-3">
          <h2 className="text-section-heading text-text-primary">Edit care plan</h2>
          <div>
            <label className="mb-1 block text-label text-text-secondary">About this person</label>
            <Textarea value={form.biography} onChange={(e) => setForm((f) => ({ ...f, biography: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-label text-text-secondary">Allergies (comma-separated)</label>
            <Input value={form.allergiesText} onChange={(e) => setForm((f) => ({ ...f, allergiesText: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-label text-text-secondary">Dietary requirements</label>
            <Input value={form.dietaryRequirements} onChange={(e) => setForm((f) => ({ ...f, dietaryRequirements: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-label text-text-secondary">Mobility aids</label>
            <Input value={form.mobilityAids} onChange={(e) => setForm((f) => ({ ...f, mobilityAids: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-label text-text-secondary">Additional risk notes</label>
            <Textarea value={form.additionalRiskNotes} onChange={(e) => setForm((f) => ({ ...f, additionalRiskNotes: e.target.value }))} />
          </div>
          <label className="flex items-center gap-2 text-body text-text-primary">
            <input type="checkbox" checked={form.dnacpr} onChange={(e) => setForm((f) => ({ ...f, dnacpr: e.target.checked }))} className="h-4 w-4 accent-nhs-blue" />
            DNACPR in place
          </label>
          <label className="flex items-center gap-2 text-body text-text-primary">
            <input type="checkbox" checked={form.fallsRisk} onChange={(e) => setForm((f) => ({ ...f, fallsRisk: e.target.checked }))} className="h-4 w-4 accent-nhs-blue" />
            Falls risk
          </label>
          <label className="flex items-center gap-2 text-body text-text-primary">
            <input type="checkbox" checked={form.chokingRisk} onChange={(e) => setForm((f) => ({ ...f, chokingRisk: e.target.checked }))} className="h-4 w-4 accent-nhs-blue" />
            Choking risk
          </label>
          <div>
            <label className="mb-1 block text-label text-text-secondary">Risk level</label>
            <div className="flex gap-2">
              {(["low", "medium", "high"] as const).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, riskLevel: level }))}
                  className={[
                    "rounded-btn border px-3.5 py-[7px] text-[12px] font-medium capitalize",
                    form.riskLevel === level ? "border-nhs-blue bg-ai-blue-light text-nhs-blue" : "border-border-default bg-card-bg text-text-primary",
                  ].join(" ")}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!aiDraft} onClose={() => setAiDraft(null)}>
        <h2 className="text-section-heading text-text-primary">AI update suggestion</h2>
        <p className="mt-1 text-secondary text-text-secondary">Review and edit before saving to the care plan.</p>
        <Textarea
          className="mt-3 min-h-[220px]"
          value={aiDraft ?? ""}
          onChange={(e) => setAiDraft(e.target.value)}
        />
        <div className="flex justify-end gap-2 pt-3">
          <Button type="button" variant="secondary" onClick={() => setAiDraft(null)}>
            Dismiss
          </Button>
          <Button type="button" onClick={handleSaveAiDraft} loading={aiSaving}>
            {aiSaving ? "Saving…" : "Save to care plan"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
