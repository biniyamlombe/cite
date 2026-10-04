CREATE TABLE public.change_reviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL DEFAULT auth.uid(),
 change_id text NOT NULL,
 address_id text NOT NULL,
 status text NOT NULL DEFAULT 'unreviewed' CHECK (status IN ('unreviewed','reviewed','needs_counsel','dismissed')),
 note text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (user_id, change_id, address_id)
);
GRANT SELECT, INSERT, UPDATE ON public.change_reviews TO authenticated;
GRANT ALL ON public.change_reviews TO service_role;
ALTER TABLE public.change_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own change reviews read" ON public.change_reviews FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own change reviews create" ON public.change_reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own change reviews edit" ON public.change_reviews FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER touch_change_reviews_updated_at BEFORE UPDATE ON public.change_reviews FOR EACH ROW EXECUTE FUNCTION public.touch_review_case();