import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidOrgCode } from "@/lib/utils/orgCode";

interface RegisterOrgBody {
  name: string;
  orgCode: string;
  cqcNumber: string;
  email: string;
  phone: string;
  address: string;
  careTypes: string[];
}

function isRegisterOrgBody(value: unknown): value is RegisterOrgBody {
  if (typeof value !== "object" || value === null) return false;
  const body = value as Record<string, unknown>;
  return (
    typeof body.name === "string" &&
    typeof body.orgCode === "string" &&
    typeof body.cqcNumber === "string" &&
    typeof body.email === "string" &&
    typeof body.phone === "string" &&
    typeof body.address === "string" &&
    Array.isArray(body.careTypes) &&
    body.careTypes.every((careType) => typeof careType === "string")
  );
}

// Creates the organisation record for Step 1+2 of the registration wizard.
// Runs with the service-role client because no INSERT policy exists for
// organisations at the RLS level (Session 1 design — org creation happens
// before any authenticated users row with org_id exists). PRD section 3.3
// "On completion" behaviour: status trial, 30-day trial window.
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);

  if (!isRegisterOrgBody(body)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const orgCode = body.orgCode.toUpperCase();
  if (!isValidOrgCode(orgCode)) {
    return NextResponse.json(
      { error: "Organisation code must be 2-4 uppercase letters." },
      { status: 400 },
    );
  }

  if (!body.name.trim() || !body.email.trim() || !body.phone.trim() || !body.address.trim()) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("organisations")
    .select("id")
    .eq("org_code", orgCode)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: `${orgCode} is already in use. Please choose a different code.` },
      { status: 409 },
    );
  }

  const trialStart = new Date();
  const trialEnd = new Date(trialStart);
  trialEnd.setDate(trialEnd.getDate() + 30);

  const { data: org, error } = await supabase
    .from("organisations")
    .insert({
      name: body.name.trim(),
      org_code: orgCode,
      cqc_number: body.cqcNumber.trim() || null,
      email: body.email.trim(),
      phone: body.phone.trim(),
      address: body.address.trim(),
      care_types: body.careTypes,
      status: "trial",
      trial_start_date: trialStart.toISOString(),
      trial_end_date: trialEnd.toISOString(),
    })
    .select("id")
    .single();

  if (error || !org) {
    return NextResponse.json({ error: "Could not create organisation." }, { status: 500 });
  }

  return NextResponse.json({ orgId: org.id });
}
