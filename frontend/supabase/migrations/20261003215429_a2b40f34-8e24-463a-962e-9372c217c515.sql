CREATE TABLE public.saved_memos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  address_id text NOT NULL,
  as_of date NOT NULL,
  title text NOT NULL,
  note text,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.saved_memos TO authenticated;
GRANT ALL ON public.saved_memos TO service_role;
ALTER TABLE public.saved_memos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own memos read" ON public.saved_memos FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own memos insert" ON public.saved_memos FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own memos delete" ON public.saved_memos FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.rule_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  author_email text NOT NULL DEFAULT coalesce(auth.jwt() ->> 'email', 'unknown'),
  team_rule_id text NOT NULL,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.rule_comments TO authenticated;
GRANT ALL ON public.rule_comments TO service_role;
ALTER TABLE public.rule_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users read comments" ON public.rule_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Own comments insert" ON public.rule_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own comments delete" ON public.rule_comments FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX rule_comments_rule_idx ON public.rule_comments (team_rule_id, created_at);

CREATE TABLE public.alert_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  address_id text NOT NULL,
  email_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, address_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alert_subscriptions TO authenticated;
GRANT ALL ON public.alert_subscriptions TO service_role;
ALTER TABLE public.alert_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own subs all" ON public.alert_subscriptions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);