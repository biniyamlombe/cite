import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getCiteClient } from "@/lib/cite/client";

const Q = z.object({ as_of: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() });

/** Customer API: GET /api/public/v1/lookup/:addressId?as_of=YYYY-MM-DD with header "x-api-key". Returns the backend response as-is. */
export const Route = createFileRoute("/api/public/v1/lookup/$addressId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const key = request.headers.get("x-api-key") ?? "";
        if (!/^cite_[0-9a-f]{48}$/.test(key)) return Response.json({ error: "invalid api key" }, { status: 401 });
        const parsed = Q.safeParse(Object.fromEntries(new URL(request.url).searchParams));
        if (!parsed.success || !/^[\w-]{1,64}$/.test(params.addressId)) return Response.json({ error: "bad request" }, { status: 400 });
        const { createHash } = await import("node:crypto");
        const hash = createHash("sha256").update(key).digest("hex");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: row } = await supabaseAdmin.from("api_keys").select("id,revoked_at").eq("key_hash", hash).maybeSingle();
        if (!row || row.revoked_at) return Response.json({ error: "invalid api key" }, { status: 401 });
        await supabaseAdmin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", row.id);
        try {
          const data = await getCiteClient().lookup(params.addressId, parsed.data.as_of ?? new Date().toISOString().slice(0, 10));
          return Response.json(data, { headers: { "cache-control": "no-store" } });
        } catch {
          return Response.json({ error: "not found" }, { status: 404 });
        }
      },
    },
  },
});
