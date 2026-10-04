import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Flag } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/lib/i18n";
import type { LookupResponse } from "@/lib/cite/types";

type FieldName = "units" | "year_built" | "legal_city" | "other";

export function FactCorrection({ data }: { data: LookupResponse }) {
  const t = useT();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [field, setField] = useState<FieldName>("units");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const addressId = data.address.address_id;
  const requests = useQuery({
    queryKey: ["fact-corrections", user?.id, addressId],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("fact_correction_requests")
        .select("id,field_name,reported_value,status,created_at")
        .eq("address_id", addressId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return rows ?? [];
    },
    enabled: !!user && open,
  });
  const submit = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("fact_correction_requests").insert({
        address_id: addressId,
        field_name: field,
        reported_value: value.trim(),
        explanation: reason.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setValue("");
      setReason("");
      void qc.invalidateQueries({ queryKey: ["fact-corrections", user?.id, addressId] });
    },
  });
  return (
    <div className="mt-4 border-t border-border pt-3 text-xs">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 text-primary hover:underline"
      >
        <Flag className="size-3.5" />
        {t("correction.report")}
      </button>
      {open && (
        <div className="mt-4 grid gap-5 md:grid-cols-[minmax(0,1fr)_15rem]">
          <div>
            <p className="mb-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
              {t("correction.caveat")}
            </p>
            {!user ? (
              <a href="/auth" className="text-sm text-primary underline">
                {t("correction.signin")}
              </a>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (value.trim() && reason.trim()) submit.mutate();
                }}
                className="max-w-lg space-y-3"
              >
                <label className="block font-medium text-ink">
                  {t("correction.field")}
                  <select
                    value={field}
                    onChange={(e) => setField(e.target.value as FieldName)}
                    className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
                  >
                    {(["units", "year_built", "legal_city", "other"] as FieldName[]).map((f) => (
                      <option key={f} value={f}>
                        {t(`correction.${f}`)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block font-medium text-ink">
                  {t("correction.value")}
                  <input
                    required
                    maxLength={500}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
                  />
                </label>
                <label className="block font-medium text-ink">
                  {t("correction.reason")}
                  <textarea
                    required
                    maxLength={2000}
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
                  />
                </label>
                <button
                  type="submit"
                  disabled={submit.isPending}
                  className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  {submit.isPending ? t("common.loading") : t("correction.submit")}
                </button>
                {submit.isError && (
                  <p role="alert" className="text-destructive">
                    {submit.error.message}
                  </p>
                )}
                {submit.isSuccess && (
                  <p role="status" className="text-primary">
                    {t("correction.sent")}
                  </p>
                )}
              </form>
            )}
          </div>
          {user && (
            <div className="border-t border-border pt-3 md:border-l md:border-t-0 md:pl-5 md:pt-0">
              <h3 className="eyebrow mb-2">{t("correction.history")}</h3>
              {requests.isLoading && t("common.loading")}
              {requests.isError && (
                <p role="alert" className="text-destructive">
                  {requests.error.message}
                </p>
              )}
              {requests.data?.length === 0 && (
                <p className="text-muted-foreground">{t("correction.none")}</p>
              )}
              {requests.data?.map((r) => (
                <div key={r.id} className="border-t py-2">
                  <span className="font-medium text-ink">
                    {r.field_name}: {r.reported_value}
                  </span>
                  <span className="block text-muted-foreground">
                    {r.status} · {new Date(r.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
