import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidOrgCode } from "@/lib/utils/orgCode";

// Real-time org code uniqueness check for Step 2 of registration.
// Source: ID and Reference System Specification section 4.2 ("Validation:
// real-time check against database for uniqueness").
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = (searchParams.get("code") ?? "").toUpperCase();

  if (!isValidOrgCode(code)) {
    return NextResponse.json({ available: false, reason: "invalid_format" });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("organisations")
    .select("id")
    .eq("org_code", code)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ available: false, reason: "error" }, { status: 500 });
  }

  return NextResponse.json({ available: data === null });
}
