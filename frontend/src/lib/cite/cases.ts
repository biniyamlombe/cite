// Review workflow only. Legal determinations remain the backend's lookup response.
import { supabase } from "@/integrations/supabase/client";
import type { LookupResponse } from "./types";

export type CaseStatus = "open" | "needs_counsel" | "approved" | "closed";
export interface ReviewCase {
  id: string;
  address_id: string;
  as_of: string;
  title: string;
  assignee: string;
  status: CaseStatus;
  questions: string;
  evidence_notes: string;
  snapshot: LookupResponse;
  created_at: string;
  updated_at: string;
}
export interface ReviewEvent {
  id: string;
  case_id: string;
  action: string;
  detail: string;
  created_at: string;
}

export async function listCases(): Promise<ReviewCase[]> {
  const { data, error } = await supabase.from("review_cases").select("*").order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as ReviewCase[];
}

export async function createCase(snapshot: LookupResponse): Promise<string> {
  const { data, error } = await supabase.from("review_cases").insert({
    address_id: snapshot.address.address_id,
    as_of: snapshot.as_of,
    title: `${snapshot.address.street_address}, ${snapshot.address.postal_city}`,
    snapshot: JSON.parse(JSON.stringify(snapshot)),
  }).select("id").single();
  if (error) throw error;
  return data.id;
}

export async function updateCase(id: string, changes: Pick<ReviewCase, "title" | "assignee" | "status" | "questions" | "evidence_notes">) {
  const { error } = await supabase.from("review_cases").update(changes).eq("id", id);
  if (error) throw error;
}

export async function listCaseEvents(caseId: string): Promise<ReviewEvent[]> {
  const { data, error } = await supabase.from("review_events").select("id,case_id,action,detail,created_at").eq("case_id", caseId).order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}