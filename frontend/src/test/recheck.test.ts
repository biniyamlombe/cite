// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { runRechecks } from "@/lib/cite/recheck.server";
import { summarizeLookup } from "@/lib/cite/lookup-diff";
import { mockLookup } from "@/mocks/cite";
import type { CiteApiClient } from "@/lib/cite/client";
const before = mockLookup("A0002", "2026-10-01")!;
const after = structuredClone(before);
after.results[0]!.conflict_flag = !after.results[0]!.conflict_flag;
function database(options: { persistenceError?: boolean; hooks?: boolean } = {}) {
  const scheduleUpdate = vi.fn();
  const webhookUpdate = vi.fn();
  const row = { id: "s", address_id: "A0002", frequency: "daily", user_id: "u", last_run_at: null, last_summary: summarizeLookup(before) };
  return {
    scheduleUpdate, webhookUpdate,
    from: (table: string) => ({
      select: () => {
        const response = { data: table === "recheck_schedules" ? [row] : options.hooks ? [{ id: "h", url: "https://example.invalid/hook", secret: "test" }] : [], error: null };
        const chain = { eq: () => chain, then: (resolve: (v: typeof response) => unknown) => Promise.resolve(response).then(resolve) };
        return chain;
      },
      update: (value: unknown) => ({ eq: async () => {
        (table === "recheck_schedules" ? scheduleUpdate : webhookUpdate)(value);
        return { data: null, error: options.persistenceError && table === "recheck_schedules" ? { message: "write failed" } : null };
      } }),
    }),
  };
}
const client = { mode: "live", lookup: async () => after } as unknown as CiteApiClient;
afterEach(() => vi.unstubAllGlobals());
it("counts non-2xx delivery as failure and keeps the old baseline for retry", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("failed", { status: 500 })));
  const db = database({ hooks: true });
  const result = await runRechecks(db as never, {}, client);
  expect(result.delivered).toBe(0); expect(result.failed).toBe(1); expect(result.ran).toBe(0);
  expect(db.scheduleUpdate).not.toHaveBeenCalled();
  expect(db.webhookUpdate).toHaveBeenCalledWith(expect.objectContaining({ last_status: 500 }));
});
it("does not report persisted success when the database rejects the update", async () => {
  const result = await runRechecks(database({ persistenceError: true }) as never, {}, client);
  expect(result.ran).toBe(0); expect(result.failed).toBe(1);
});
it("records a successful conflict-only change", async () => {
  const result = await runRechecks(database() as never, {}, client);
  expect(result).toMatchObject({ ran: 1, changed: 1, failed: 0 });
});
it("refuses to persist fictional mock monitoring", async () => {
  await expect(runRechecks(database() as never, {}, { ...client, mode: "mock" })).rejects.toThrow(/live API/);
});
