import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/** Lovable Cloud / Supabase is optional. Empty values in `.env.local` mean offline corpus mode. */
function cloudAuthConfigured(): boolean {
  const url = import.meta.env["VITE_SUPABASE_URL"];
  const key = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  return typeof url === "string" && url.length > 0 && typeof key === "string" && key.length > 0;
}

/** Current signed-in session (null when signed out or when cloud auth is unset). `ready` is false until the first check finishes. */
export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!cloudAuthConfigured()) {
      setReady(true);
      return;
    }
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    supabase.auth.getSession().then(({ data: d }) => {
      setSession(d.session);
      setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  return { session, user: session?.user ?? null, ready };
}
