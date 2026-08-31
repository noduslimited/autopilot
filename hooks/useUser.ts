"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

type UserRow = Database["public"]["Tables"]["users"]["Row"];

interface UseUserResult {
  user: UserRow | null;
  loading: boolean;
}

// Current authenticated user + their `users` table row (role, org_id,
// status, etc). Source: TRD section 3 hooks/ listing.
export function useUser(): UseUserResult {
  const [user, setUser] = useState<UserRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function load() {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) {
        if (!cancelled) {
          setUser(null);
          setLoading(false);
        }
        return;
      }

      const { data } = await supabase.from("users").select("*").eq("id", authUser.id).single();

      if (!cancelled) {
        setUser(data);
        setLoading(false);
      }
    }

    void load();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void load();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return { user, loading };
}
