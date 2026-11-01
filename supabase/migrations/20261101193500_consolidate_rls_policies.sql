-- Remove overlapping legacy policies and keep one policy per operation path.
DROP POLICY IF EXISTS "Spieler dürfen eigenes Profil bearbeiten" ON public.profiles;
DROP POLICY IF EXISTS "Nutzer dürfen eigenes Profil bearbeiten ohne Rollen-Eskalation" ON public.profiles;
CREATE POLICY "Nutzer dürfen eigenes Profil bearbeiten ohne Rollen-Eskalation"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT auth.uid()) = auth_user_id
    OR (SELECT public.is_admin())
  )
  WITH CHECK (
    (SELECT public.is_admin())
    OR (
      (SELECT auth.uid()) = auth_user_id
      AND role = (
        SELECT p.role
        FROM public.profiles p
        WHERE p.auth_user_id = (SELECT auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "Alle Spieler dürfen Turniere lesen" ON public.tournaments;
DROP POLICY IF EXISTS "Jeder darf Turniere lesen" ON public.tournaments;
DROP POLICY IF EXISTS "Admins und Turnierleiter dürfen Turniere verwalten" ON public.tournaments;
CREATE POLICY "Jeder darf Turniere lesen"
  ON public.tournaments
  FOR SELECT
  USING (true);
CREATE POLICY "Admins und Turnierleiter dürfen Turniere anlegen"
  ON public.tournaments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT public.is_admin())
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.auth_user_id = (SELECT auth.uid())
        AND p.role IN ('owner', 'co_owner', 'admin', 'organiser')
    )
  );
CREATE POLICY "Admins und Turnierleiter dürfen Turniere bearbeiten"
  ON public.tournaments
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT public.is_admin())
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.auth_user_id = (SELECT auth.uid())
        AND p.role IN ('owner', 'co_owner', 'admin', 'organiser')
    )
  )
  WITH CHECK (
    (SELECT public.is_admin())
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.auth_user_id = (SELECT auth.uid())
        AND p.role IN ('owner', 'co_owner', 'admin', 'organiser')
    )
  );
CREATE POLICY "Admins und Turnierleiter dürfen Turniere löschen"
  ON public.tournaments
  FOR DELETE
  TO authenticated
  USING (
    (SELECT public.is_admin())
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.auth_user_id = (SELECT auth.uid())
        AND p.role IN ('owner', 'co_owner', 'admin', 'organiser')
    )
  );

DROP POLICY IF EXISTS "Admins dürfen Whitelist lesen" ON public.whitelist;
DROP POLICY IF EXISTS "Nur Admins dürfen Whitelist löschen" ON public.whitelist;
DROP POLICY IF EXISTS "Nur Admins dürfen Whitelist bearbeiten" ON public.whitelist;
CREATE POLICY "Nur Admins dürfen Whitelist bearbeiten"
  ON public.whitelist
  FOR ALL
  TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));
