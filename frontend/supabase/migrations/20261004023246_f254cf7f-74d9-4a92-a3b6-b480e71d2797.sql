CREATE TABLE public.fact_correction_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL DEFAULT auth.uid(),
 address_id text NOT NULL,
 field_name text NOT NULL CHECK (field_name IN ('year_built','units','legal_city','other')),
 reported_value text NOT NULL CHECK (char_length(reported_value) BETWEEN 1 AND 500),
 explanation text NOT NULL CHECK (char_length(explanation) BETWEEN 1 AND 2000),
 status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','in_review','resolved','rejected')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.fact_correction_requests TO authenticated;
GRANT ALL ON public.fact_correction_requests TO service_role;
ALTER TABLE public.fact_correction_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own correction requests read" ON public.fact_correction_requests FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own correction requests create" ON public.fact_correction_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND status = 'submitted');
CREATE TRIGGER touch_fact_correction_requests_updated_at BEFORE UPDATE ON public.fact_correction_requests FOR EACH ROW EXECUTE FUNCTION public.touch_review_case();