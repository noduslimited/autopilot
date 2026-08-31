"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input, Textarea, Select, FieldLabel } from "@/components/ui/Input";
import { StepIndicator } from "./StepIndicator";

// Source: PRD section 4.3 ("Add Client — 4-step form")
interface StaffOption {
  id: string;
  first_name: string;
  last_name: string;
}

const CARE_NEED_OPTIONS = [
  { key: "meal_prep", label: "Meal preparation" },
  { key: "medication", label: "Medication administration" },
  { key: "moving", label: "Moving and handling" },
  { key: "personal_care", label: "Personal care" },
  { key: "companionship", label: "Companionship" },
  { key: "housekeeping", label: "Housekeeping" },
  { key: "other", label: "Other" },
];

interface FormState {
  firstName: string;
  lastName: string;
  dob: string;
  nhsNumber: string;
  address: string;
  careType: string;
  assignedCarerId: string;
  biography: string;
  careNeeds: Record<string, boolean>;
  careNeedDetails: Record<string, string>;
  visitFrequency: string;
  visitDuration: string;
  allergiesText: string;
  dietaryRequirements: string;
  dnacpr: boolean;
  riskLevel: string;
  mobilityAids: string;
  fallsRisk: boolean;
  chokingRisk: boolean;
  additionalRiskNotes: string;
  nokName: string;
  nokRelationship: string;
  nokEmail: string;
  nokPhone: string;
  gpName: string;
  gpPractice: string;
  gpPhone: string;
  sendNokInvitation: boolean;
}

const INITIAL_STATE: FormState = {
  firstName: "",
  lastName: "",
  dob: "",
  nhsNumber: "",
  address: "",
  careType: "",
  assignedCarerId: "",
  biography: "",
  careNeeds: {},
  careNeedDetails: {},
  visitFrequency: "",
  visitDuration: "",
  allergiesText: "",
  dietaryRequirements: "",
  dnacpr: false,
  riskLevel: "low",
  mobilityAids: "",
  fallsRisk: false,
  chokingRisk: false,
  additionalRiskNotes: "",
  nokName: "",
  nokRelationship: "",
  nokEmail: "",
  nokPhone: "",
  gpName: "",
  gpPractice: "",
  gpPhone: "",
  sendNokInvitation: true,
};

function step1Valid(state: FormState): boolean {
  return !!(state.firstName.trim() && state.lastName.trim() && state.dob && state.address.trim() && state.careType);
}

export function AddClientForm({ staff }: { staff: StaffOption[] }) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleCareNeed(key: string) {
    setForm((current) => ({ ...current, careNeeds: { ...current.careNeeds, [key]: !current.careNeeds[key] } }));
  }

  function buildClientPayload(orgId: string, status: "active" | "draft") {
    return {
      org_id: orgId,
      // Populated by the set_client_ref trigger — Supabase's generated
      // Insert type still requires the key present (see the trigger's
      // 20260831090200 migration for why it's an empty string, not omitted).
      client_ref: "",
      first_name: form.firstName.trim(),
      last_name: form.lastName.trim(),
      date_of_birth: form.dob,
      nhs_number: form.nhsNumber.trim() || null,
      address: form.address.trim(),
      care_type: form.careType,
      assigned_carer_id: form.assignedCarerId || null,
      biography: form.biography.trim() || null,
      visit_frequency: form.visitFrequency || null,
      visit_duration_minutes: form.visitDuration ? Number(form.visitDuration) : null,
      allergies: form.allergiesText
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      dietary_requirements: form.dietaryRequirements.trim() || null,
      dnacpr: form.dnacpr,
      risk_level: form.riskLevel,
      mobility_aids: form.mobilityAids.trim() || null,
      falls_risk: form.fallsRisk,
      choking_risk: form.chokingRisk,
      additional_risk_notes: form.additionalRiskNotes.trim() || null,
      nok_name: form.nokName.trim() || null,
      nok_relationship: form.nokRelationship || null,
      nok_email: form.nokEmail.trim() || null,
      nok_phone: form.nokPhone.trim() || null,
      gp_name: form.gpName.trim() || null,
      gp_practice: form.gpPractice.trim() || null,
      gp_phone: form.gpPhone.trim() || null,
      status,
    };
  }

  async function getOrgId(supabase: ReturnType<typeof createClient>): Promise<string> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: managerRow } = await supabase.from("users").select("org_id").eq("id", user!.id).single();
    return managerRow!.org_id;
  }

  async function saveCarePlan(supabase: ReturnType<typeof createClient>, orgId: string, clientId: string) {
    const whatWeHelpWith = Object.keys(form.careNeeds).filter((key) => form.careNeeds[key]);
    const careNeeds = whatWeHelpWith.map((key) => ({ type: key, detail: form.careNeedDetails[key] ?? "" }));

    if (whatWeHelpWith.length === 0) return;

    await supabase.from("care_plans").insert({
      org_id: orgId,
      client_id: clientId,
      what_we_help_with: whatWeHelpWith,
      care_needs: careNeeds,
    });
  }

  function handleContinue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (step === 1 && !step1Valid(form)) {
      setError("Please fill in all required fields.");
      return;
    }

    setStep((current) => (current < 4 ? ((current + 1) as 2 | 3 | 4) : current));
  }

  async function handleSaveDraft() {
    setError(null);
    if (!step1Valid(form)) {
      setError("First name, last name, date of birth, address, and care type are required before saving a draft.");
      return;
    }

    setSubmitting(true);
    const supabase = createClient();
    const orgId = await getOrgId(supabase);
    const { error: insertError } = await supabase.from("clients").insert(buildClientPayload(orgId, "draft"));

    if (insertError) {
      setError("Something went wrong saving the draft. Please try again.");
      setSubmitting(false);
      return;
    }

    router.push("/clients");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!form.nokName.trim() || !form.nokEmail.trim() || !form.nokPhone.trim()) {
      setError("Please fill in all required fields.");
      return;
    }

    setSubmitting(true);
    const supabase = createClient();
    const orgId = await getOrgId(supabase);

    const { data: client, error: insertError } = await supabase
      .from("clients")
      .insert(buildClientPayload(orgId, "active"))
      .select("id, client_ref, first_name, last_name")
      .single();

    if (insertError || !client) {
      setError("Something went wrong creating this client. Please try again.");
      setSubmitting(false);
      return;
    }

    await saveCarePlan(supabase, orgId, client.id);

    // Invitation failure is non-fatal to the flow (the client is already
    // created), but it must not be silently discarded — a fetch() promise
    // only rejects on a network-level failure, not on a 4xx/5xx response,
    // so response.ok has to be checked explicitly. The reason is passed
    // through to the profile page as a query param and shown as a warning
    // banner there, since no app-wide toast system is wired up yet.
    let nokInviteError: string | null = null;
    if (form.sendNokInvitation) {
      const response = await fetch("/api/clients/invite-nok", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: client.id,
          email: form.nokEmail.trim(),
          relationship: form.nokRelationship,
          nokName: form.nokName.trim(),
        }),
      }).catch(() => null);

      if (!response || !response.ok) {
        const body: { error?: string } = response ? await response.json().catch(() => ({})) : {};
        nokInviteError = body.error || "Could not send the family portal invitation.";
      }
    }

    const params = new URLSearchParams({ created: "1" });
    if (nokInviteError) params.set("nokInviteError", nokInviteError);
    router.push(`/clients/${client.id}?${params.toString()}`);
  }

  return (
    <div className="mx-auto max-w-2xl p-5">
      <h1 className="text-page-heading text-text-primary">Add client</h1>
      <div className="mt-4">
        <StepIndicator currentStep={step} />
      </div>

      <form onSubmit={step === 4 ? handleSubmit : handleContinue} className="mt-6 space-y-4">
        {step === 1 ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel required>First name</FieldLabel>
                <Input required value={form.firstName} onChange={(e) => update("firstName", e.target.value)} />
              </div>
              <div>
                <FieldLabel required>Last name</FieldLabel>
                <Input required value={form.lastName} onChange={(e) => update("lastName", e.target.value)} />
              </div>
            </div>
            <div>
              <FieldLabel required>Date of birth</FieldLabel>
              <Input type="date" required value={form.dob} onChange={(e) => update("dob", e.target.value)} />
            </div>
            <div>
              <FieldLabel>NHS number</FieldLabel>
              <Input value={form.nhsNumber} onChange={(e) => update("nhsNumber", e.target.value)} />
            </div>
            <div>
              <FieldLabel required>Home address</FieldLabel>
              <Input required value={form.address} onChange={(e) => update("address", e.target.value)} />
            </div>
            <div>
              <FieldLabel required>Care type</FieldLabel>
              <Select required value={form.careType} onChange={(e) => update("careType", e.target.value)}>
                <option value="">Select care type…</option>
                <option value="domiciliary">Domiciliary</option>
                <option value="residential">Residential</option>
                <option value="supported_living">Supported living</option>
              </Select>
            </div>
            <div>
              <FieldLabel>Assigned carer</FieldLabel>
              <Select value={form.assignedCarerId} onChange={(e) => update("assignedCarerId", e.target.value)}>
                <option value="">No carer assigned yet</option>
                {staff.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.first_name} {member.last_name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <FieldLabel>About this person</FieldLabel>
              <Textarea value={form.biography} onChange={(e) => update("biography", e.target.value)} />
            </div>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <div>
              <FieldLabel>What we help with</FieldLabel>
              <div className="space-y-2">
                {CARE_NEED_OPTIONS.map((option) => (
                  <div key={option.key}>
                    <label className="flex items-center gap-2 text-body text-text-primary">
                      <input
                        type="checkbox"
                        checked={!!form.careNeeds[option.key]}
                        onChange={() => toggleCareNeed(option.key)}
                        className="h-4 w-4 accent-nhs-blue"
                      />
                      {option.label}
                    </label>
                    {form.careNeeds[option.key] ? (
                      <Input
                        className="mt-1.5"
                        placeholder={`${option.label} detail…`}
                        value={form.careNeedDetails[option.key] ?? ""}
                        onChange={(e) =>
                          setForm((current) => ({
                            ...current,
                            careNeedDetails: { ...current.careNeedDetails, [option.key]: e.target.value },
                          }))
                        }
                      />
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <FieldLabel>Visit frequency</FieldLabel>
              <Select value={form.visitFrequency} onChange={(e) => update("visitFrequency", e.target.value)}>
                <option value="">Select…</option>
                <option value="daily">Daily</option>
                <option value="twice_daily">Twice daily</option>
                <option value="three_times_daily">Three times daily</option>
                <option value="weekly">Weekly</option>
                <option value="custom">Custom</option>
              </Select>
            </div>
            <div>
              <FieldLabel>Visit duration</FieldLabel>
              <Select value={form.visitDuration} onChange={(e) => update("visitDuration", e.target.value)}>
                <option value="">Select…</option>
                <option value="30">30 mins</option>
                <option value="45">45 mins</option>
                <option value="60">1 hour</option>
                <option value="90">1.5 hours</option>
                <option value="120">2 hours</option>
              </Select>
            </div>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <div>
              <FieldLabel>Allergies (comma-separated)</FieldLabel>
              <Input value={form.allergiesText} onChange={(e) => update("allergiesText", e.target.value)} />
            </div>
            <div>
              <FieldLabel>Dietary requirements</FieldLabel>
              <Input value={form.dietaryRequirements} onChange={(e) => update("dietaryRequirements", e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-body text-text-primary">
              <input type="checkbox" checked={form.dnacpr} onChange={(e) => update("dnacpr", e.target.checked)} className="h-4 w-4 accent-nhs-blue" />
              DNACPR in place
            </label>
            <div>
              <FieldLabel>Risk level</FieldLabel>
              <div className="flex gap-2">
                {(["low", "medium", "high"] as const).map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => update("riskLevel", level)}
                    className={[
                      "rounded-btn border px-3.5 py-[7px] text-[12px] font-medium capitalize",
                      form.riskLevel === level
                        ? level === "high"
                          ? "border-nhs-red bg-danger-red-light text-nhs-red"
                          : "border-nhs-blue bg-ai-blue-light text-nhs-blue"
                        : "border-border-default bg-card-bg text-text-primary",
                    ].join(" ")}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <FieldLabel>Mobility aids in use</FieldLabel>
              <Input value={form.mobilityAids} onChange={(e) => update("mobilityAids", e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-body text-text-primary">
              <input type="checkbox" checked={form.fallsRisk} onChange={(e) => update("fallsRisk", e.target.checked)} className="h-4 w-4 accent-nhs-blue" />
              Falls risk
            </label>
            <label className="flex items-center gap-2 text-body text-text-primary">
              <input type="checkbox" checked={form.chokingRisk} onChange={(e) => update("chokingRisk", e.target.checked)} className="h-4 w-4 accent-nhs-blue" />
              Choking risk
            </label>
            <div>
              <FieldLabel>Additional risk notes</FieldLabel>
              <Textarea value={form.additionalRiskNotes} onChange={(e) => update("additionalRiskNotes", e.target.value)} />
            </div>
          </>
        ) : null}

        {step === 4 ? (
          <>
            <div>
              <FieldLabel required>Next of kin name</FieldLabel>
              <Input required value={form.nokName} onChange={(e) => update("nokName", e.target.value)} />
            </div>
            <div>
              <FieldLabel>NOK relationship</FieldLabel>
              <Select value={form.nokRelationship} onChange={(e) => update("nokRelationship", e.target.value)}>
                <option value="">Select…</option>
                <option value="Son">Son</option>
                <option value="Daughter">Daughter</option>
                <option value="Spouse">Spouse</option>
                <option value="Partner">Partner</option>
                <option value="Sibling">Sibling</option>
                <option value="Other">Other</option>
              </Select>
            </div>
            <div>
              <FieldLabel required>NOK email</FieldLabel>
              <Input type="email" required value={form.nokEmail} onChange={(e) => update("nokEmail", e.target.value)} />
            </div>
            <div>
              <FieldLabel required>NOK phone number</FieldLabel>
              <Input required value={form.nokPhone} onChange={(e) => update("nokPhone", e.target.value)} />
            </div>
            <div>
              <FieldLabel>GP name</FieldLabel>
              <Input value={form.gpName} onChange={(e) => update("gpName", e.target.value)} />
            </div>
            <div>
              <FieldLabel>GP practice name</FieldLabel>
              <Input value={form.gpPractice} onChange={(e) => update("gpPractice", e.target.value)} />
            </div>
            <div>
              <FieldLabel>GP phone number</FieldLabel>
              <Input value={form.gpPhone} onChange={(e) => update("gpPhone", e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-body text-text-primary">
              <input
                type="checkbox"
                checked={form.sendNokInvitation}
                onChange={(e) => update("sendNokInvitation", e.target.checked)}
                className="h-4 w-4 accent-nhs-blue"
              />
              Send family portal invitation on save
            </label>
          </>
        ) : null}

        {error ? <p className="text-secondary text-nhs-red">{error}</p> : null}

        <div className="flex gap-2 pt-2">
          {step > 1 ? (
            <Button type="button" variant="secondary" onClick={() => setStep((current) => (current - 1) as 1 | 2 | 3)}>
              Back
            </Button>
          ) : null}
          <Button type="button" variant="secondary" disabled={submitting} onClick={handleSaveDraft}>
            Save as draft
          </Button>
          <div className="flex-1" />
          <Button type="submit" disabled={submitting}>
            {step === 4 ? (submitting ? "Adding client…" : "Add client") : "Continue"}
          </Button>
        </div>
      </form>
    </div>
  );
}
