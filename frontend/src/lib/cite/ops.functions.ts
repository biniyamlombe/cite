import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runRechecks } from "./recheck.server";

/** Runs the signed-in user's own re-checks now (as that user, row rules apply). */
export const runMyRechecks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => runRechecks(context.supabase, { force: true, userId: context.userId }));
