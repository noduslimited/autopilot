"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { suggestOrgCode, isValidOrgCode } from "@/lib/utils/orgCode";
import { AuthLogo } from "../_components/AuthLogo";
import { StepIndicator } from "./StepIndicator";

const CARE_TYPE_OPTIONS = [
  { value: "domiciliary", label: "Domiciliary" },
  { value: "residential", label: "Residential" },
  { value: "supported_living", label: "Supported living" },
];

type CodeStatus = "idle" | "checking" | "available" | "taken" | "invalid";

export function OrgRegisterForm() {
  const router = useRouter();

  const [step, setStep] = useState<1 | 2>(1);
  const [stepError, setStepError] = useState<string | null>(null);

  // Step 1 — organisation details (PRD section 3.3, Step 1)
  const [orgName, setOrgName] = useState("");
  const [cqcNumber, setCqcNumber] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [careTypes, setCareTypes] = useState<string[]>([]);

  // Step 2 — org code confirmation + manager account (matches the approved
  // mockup, which combines these on one screen)
  const [orgCode, setOrgCode] = useState("");
  const [codeStatus, setCodeStatus] = useState<CodeStatus>("idle");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [workEmail, setWorkEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (step !== 2) return;
    if (!orgCode) {
      setCodeStatus("idle");
      return;
    }
    if (!isValidOrgCode(orgCode)) {
      setCodeStatus("invalid");
      return;
    }

    setCodeStatus("checking");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/register/check-org-code?code=${encodeURIComponent(orgCode)}`,
        );
        const result: { available: boolean } = await response.json();
        setCodeStatus(result.available ? "available" : "taken");
      } catch {
        setCodeStatus("idle");
      }
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [orgCode, step]);

  function toggleCareType(value: string) {
    setCareTypes((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    );
  }

  function handleContinue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStepError(null);

    if (!orgName.trim() || !cqcNumber.trim() || !contactEmail.trim() || !phone.trim() || !address.trim()) {
      setStepError("Please fill in all required fields.");
      return;
    }
    if (careTypes.length === 0) {
      setStepError("Select at least one care type.");
      return;
    }

    if (!orgCode) setOrgCode(suggestOrgCode(orgName));
    setStep(2);
  }

  async function handleCreateAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStepError(null);

    if (!isValidOrgCode(orgCode) || codeStatus === "taken") {
      setStepError("Please choose a valid, available organisation code.");
      return;
    }
    if (!firstName.trim() || !lastName.trim() || !workEmail.trim()) {
      setStepError("Please fill in all required fields.");
      return;
    }
    if (password.length < 8) {
      setStepError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setStepError("Passwords do not match.");
      return;
    }
    if (!termsAccepted) {
      setStepError("You must agree to the Terms of Service and Privacy Policy to continue.");
      return;
    }

    setSubmitting(true);

    const orgResponse = await fetch("/api/register/organisation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: orgName,
        orgCode,
        cqcNumber,
        email: contactEmail,
        phone,
        address,
        careTypes,
        termsAccepted,
      }),
    });

    const orgResult: { orgId?: string; error?: string } = await orgResponse.json();

    if (!orgResponse.ok || !orgResult.orgId) {
      setStepError(orgResult.error ?? "Something went wrong. Please try again.");
      setSubmitting(false);
      return;
    }

    const accountResponse = await fetch("/api/register/manager-account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orgId: orgResult.orgId,
        firstName,
        lastName,
        email: workEmail,
        password,
      }),
    });

    const accountResult: { success?: boolean; error?: string } = await accountResponse.json();

    if (!accountResponse.ok || !accountResult.success) {
      setStepError(accountResult.error ?? "Something went wrong creating your account. Please try again.");
      setSubmitting(false);
      return;
    }

    // Account was created (and confirmed) server-side — sign in with the
    // password just set to establish a real browser session.
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: workEmail,
      password,
    });

    if (signInError) {
      setStepError("Account created, but sign-in failed. Please sign in from the login page.");
      setSubmitting(false);
      return;
    }

    // Auth route + authenticated session -> middleware redirects to /dashboard.
    router.refresh();
  }

  return (
    <div className="w-full max-w-[420px] rounded-card border border-border-default bg-card-bg p-8">
      <AuthLogo />

      <div className="mt-6">
        <StepIndicator currentStep={step} />
      </div>

      {step === 1 ? (
        <form onSubmit={handleContinue} className="mt-6 space-y-4">
          <h1 className="text-section-heading text-text-primary">Tell us about your service</h1>

          <Field label="Organisation name" required>
            <TextInput value={orgName} onChange={setOrgName} placeholder="Oak Tree Support" />
          </Field>
          <Field label="CQC registration number" required>
            <TextInput value={cqcNumber} onChange={setCqcNumber} />
          </Field>
          <Field label="Primary contact email" required>
            <TextInput type="email" value={contactEmail} onChange={setContactEmail} />
          </Field>
          <Field label="Phone number" required>
            <TextInput type="tel" value={phone} onChange={setPhone} />
          </Field>
          <Field label="Address" required>
            <TextInput value={address} onChange={setAddress} />
          </Field>
          <Field label="Care type(s)" required>
            <div className="space-y-2">
              {CARE_TYPE_OPTIONS.map((option) => (
                <label key={option.value} className="flex items-center gap-2 text-body text-text-primary">
                  <input
                    type="checkbox"
                    checked={careTypes.includes(option.value)}
                    onChange={() => toggleCareType(option.value)}
                    className="h-4 w-4 accent-nhs-blue"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </Field>

          {stepError ? <p className="text-secondary text-nhs-red">{stepError}</p> : null}

          <button
            type="submit"
            className="w-full rounded-btn bg-nhs-blue px-4 py-3 text-body font-medium text-white"
          >
            Continue
          </button>
        </form>
      ) : (
        <form onSubmit={handleCreateAccount} className="mt-6 space-y-4">
          <div>
            <h1 className="text-section-heading text-text-primary">Confirm your organisation code</h1>
            <p className="mt-1 text-secondary text-text-secondary">
              This prefix appears in all your record IDs. You can edit it now — it cannot be
              changed after you continue.
            </p>
          </div>

          <Field label="Organisation code" required>
            <TextInput
              value={orgCode}
              onChange={(value) => setOrgCode(value.toUpperCase().slice(0, 4))}
              className="font-mono font-medium tracking-wide text-nhs-blue"
            />
          </Field>
          <p className="text-secondary text-text-secondary">
            2–4 uppercase letters · Must be unique across all organisations
          </p>
          {codeStatus === "taken" ? (
            <p className="text-secondary text-nhs-red">
              {orgCode} is already in use. Please choose a different code.
            </p>
          ) : null}
          {codeStatus === "invalid" ? (
            <p className="text-secondary text-nhs-red">2–4 uppercase letters only.</p>
          ) : null}

          <div className="rounded-[10px] bg-nhs-dark-blue px-4 py-3">
            <p className="text-tiny uppercase tracking-[1px] text-nhs-light-blue">
              Preview — example client ID
            </p>
            <p className="mt-1 font-mono text-body font-medium text-white">
              {orgCode || "___"}-CLT-EXA-MPL-001
            </p>
          </div>

          <div className="border-t border-border-default pt-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="First name" required>
                <TextInput value={firstName} onChange={setFirstName} />
              </Field>
              <Field label="Last name" required>
                <TextInput value={lastName} onChange={setLastName} />
              </Field>
            </div>
            <div className="mt-4">
              <Field label="Work email" required>
                <TextInput type="email" value={workEmail} onChange={setWorkEmail} />
              </Field>
            </div>
            <div className="mt-4">
              <Field label="Password — at least 8 characters" required>
                <TextInput type="password" value={password} onChange={setPassword} />
              </Field>
            </div>
            <div className="mt-4">
              <Field label="Confirm password" required>
                <TextInput type="password" value={confirmPassword} onChange={setConfirmPassword} />
              </Field>
            </div>
          </div>

          <label className="flex items-start gap-2 text-body text-text-primary">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(event) => setTermsAccepted(event.target.checked)}
              className="mt-0.5 h-4 w-4 accent-nhs-blue"
            />
            <span>
              I agree to the{" "}
              <Link href="/terms" target="_blank" className="text-nhs-blue">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" target="_blank" className="text-nhs-blue">
                Privacy Policy
              </Link>
              .
            </span>
          </label>

          {stepError ? <p className="text-secondary text-nhs-red">{stepError}</p> : null}

          <button
            type="submit"
            disabled={submitting || !termsAccepted}
            className="w-full rounded-btn bg-nhs-blue px-4 py-3 text-body font-medium text-white disabled:opacity-50"
          >
            {submitting ? "Creating account…" : "Create account and start free trial"}
          </button>
          <button
            type="button"
            onClick={() => setStep(1)}
            className="w-full rounded-btn border border-border-default bg-card-bg px-4 py-3 text-body font-medium text-text-primary"
          >
            Back
          </button>

          <p className="text-center text-secondary text-text-secondary">
            30-day free trial — no card required.
          </p>
        </form>
      )}
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-label text-text-secondary">
        {label}
        {required ? <span className="text-nhs-red"> *</span> : null}
      </label>
      {children}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  type = "text",
  placeholder,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <input
      type={type}
      required
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className={`w-full rounded-input border border-border-default bg-card-bg px-3 py-[9px] text-body text-text-primary outline-none focus:border-nhs-blue ${className}`}
    />
  );
}
