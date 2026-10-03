import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { runRechecks } from "@/lib/cite/recheck.server";

export const Route = createFileRoute("/api/public/cron/recheck")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const out = await runRechecks(supabaseAdmin);
        return Response.json(out);
      },
    },
  },
});
