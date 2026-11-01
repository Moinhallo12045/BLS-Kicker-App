CREATE TABLE IF NOT EXISTS public.whitelist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern TEXT NOT NULL UNIQUE,
  added_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.whitelist ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_master_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN lower(coalesce(auth.jwt() ->> 'email', '')) = 'runekamprolf@gmail.com';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN public.is_master_admin()
    OR EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE auth_user_id = auth.uid()
        AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP POLICY IF EXISTS "Admins dürfen Whitelist lesen" ON public.whitelist;
CREATE POLICY "Admins dürfen Whitelist lesen"
  ON public.whitelist
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Nur Admins dürfen Whitelist bearbeiten" ON public.whitelist;
CREATE POLICY "Nur Admins dürfen Whitelist bearbeiten"
  ON public.whitelist
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Nur Admins dürfen Whitelist löschen" ON public.whitelist;
CREATE POLICY "Nur Admins dürfen Whitelist löschen"
  ON public.whitelist
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

INSERT INTO public.whitelist (pattern)
VALUES ('@law-school.de')
ON CONFLICT (pattern) DO NOTHING;
