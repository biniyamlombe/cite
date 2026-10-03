CREATE TABLE public.lookup_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  user_email text NOT NULL DEFAULT coalesce(auth.jwt() ->> 'email', 'unknown'),
  address_id text NOT NULL,
  as_of date NOT NULL,
  summary jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.lookup_audit TO authenticated;
GRANT ALL ON public.lookup_audit TO service_role;
ALTER TABLE public.lookup_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own audit read" ON public.lookup_audit FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own audit insert" ON public.lookup_audit FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE INDEX lookup_audit_user_idx ON public.lookup_audit (user_id, created_at DESC);