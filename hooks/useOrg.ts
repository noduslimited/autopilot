"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";
import { useUser } from "./useUser";

type OrganisationRow = Database["public"]["Tables"]["organisations"]["Row"];

interface UseOrgResult {
  org: OrganisationRow | null;
  loading: boolean;
}

// Current user's organisation. Source: TRD section 3 hooks/ listing.
export function useOrg(): UseOrgResult {
  const { user, loading: userLoading } = useUser();
  const [org, setOrg] = useState<OrganisationRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userLoading) return;

    if (!user) {
      setOrg(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const supabase = createClient();

    supabase
      .from("organisations")
      .select("*")
      .eq("id", user.org_id)
      .single()
      .then(({ data }) => {
        if (!cancelled) {
          setOrg(data);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user, userLoading]);

  return { org, loading: userLoading || loading };
}
