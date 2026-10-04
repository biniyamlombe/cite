// Human workflow metadata only; affected addresses and statuses always come from Cite API.
import { supabase } from "@/integrations/supabase/client";

export type ChangeReviewStatus = "unreviewed" | "reviewed" | "needs_counsel" | "dismissed";
export interface ChangeReview {
  id: string;
  change_id: string;
  address_id: string;
  status: ChangeReviewStatus;
  note: string;
  updated_at: string;
}

export async function listChangeReviews(): Promise<ChangeReview[]> {
  const { data, error } = await supabase
    .from("change_reviews")
    .select("id,change_id,address_id,status,note,updated_at");
  if (error) throw error;
  return (data ?? []) as ChangeReview[];
}

export async function saveChangeReview(
  change_id: string,
  address_id: string,
  status: ChangeReviewStatus,
  note: string,
) {
  const { error } = await supabase
    .from("change_reviews")
    .upsert(
      { change_id, address_id, status, note },
      { onConflict: "user_id,change_id,address_id" },
    );
  if (error) throw error;
}
