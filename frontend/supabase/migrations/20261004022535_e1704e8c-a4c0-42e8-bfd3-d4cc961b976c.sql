CREATE TABLE public.review_cases (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL DEFAULT auth.uid(),
 address_id text NOT NULL,
 as_of date NOT NULL,
 title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
 assignee text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','needs_counsel','approved','closed')),
 questions text NOT NULL DEFAULT '',
 evidence_notes text NOT NULL DEFAULT '',
 snapshot jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.review_cases TO authenticated;
GRANT ALL ON public.review_cases TO service_role;
ALTER TABLE public.review_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own cases read" ON public.review_cases FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own cases create" ON public.review_cases FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own cases edit" ON public.review_cases FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own cases remove" ON public.review_cases FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX review_cases_owner_updated_idx ON public.review_cases (user_id, updated_at DESC);
CREATE OR REPLACE FUNCTION public.touch_review_case() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER touch_review_case_updated_at BEFORE UPDATE ON public.review_cases FOR EACH ROW EXECUTE FUNCTION public.touch_review_case();
CREATE TABLE public.review_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 case_id uuid NOT NULL REFERENCES public.review_cases(id) ON DELETE CASCADE,
 user_id uuid NOT NULL DEFAULT auth.uid(),
 action text NOT NULL CHECK (action IN ('created','updated','open','needs_counsel','approved','closed')),
 detail text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.review_events TO authenticated;
GRANT ALL ON public.review_events TO service_role;
ALTER TABLE public.review_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own case events read" ON public.review_events FOR SELECT TO authenticated USING (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.review_cases c WHERE c.id = case_id AND c.user_id = auth.uid()));
CREATE POLICY "Own case events create" ON public.review_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.review_cases c WHERE c.id = case_id AND c.user_id = auth.uid()));
CREATE INDEX review_events_case_created_idx ON public.review_events (case_id, created_at);