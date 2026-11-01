-- Harden exposed SECURITY DEFINER functions.
ALTER FUNCTION public.is_admin() SET search_path = public;

REVOKE ALL ON FUNCTION public.is_master_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_owner() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_email_whitelisted(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_player_profile(TEXT, TEXT, INT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_match_result(TEXT, UUID[], UUID[], INT, INT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.acknowledge_match(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.dispute_match(UUID, TEXT, INT, INT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_player_suspension(UUID, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.prevent_profile_tampering() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.validate_match_write() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_master_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_owner() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_email_whitelisted(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_player_profile(TEXT, TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_match_result(TEXT, UUID[], UUID[], INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.acknowledge_match(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dispute_match(UUID, TEXT, INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_player_suspension(UUID, BOOLEAN) TO authenticated;

-- Match writes are limited to authenticated users with a linked profile.
DROP POLICY IF EXISTS "Spieler dürfen Matches melden" ON public.matches;
DROP POLICY IF EXISTS "Authentifizierte Spieler dürfen Matches melden" ON public.matches;
CREATE POLICY "Authentifizierte Spieler dürfen Matches melden"
  ON public.matches
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.auth_user_id = (SELECT auth.uid())
        AND p.id = creator_id
        AND (p.id = ANY(team_a) OR p.id = ANY(team_b))
    )
  );

DROP POLICY IF EXISTS "Beteiligte dürfen Matches aktualisieren" ON public.matches;
DROP POLICY IF EXISTS "Beteiligte Spieler und Admins dürfen Matches aktualisieren" ON public.matches;
CREATE POLICY "Beteiligte Spieler und Admins dürfen Matches aktualisieren"
  ON public.matches
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT public.is_admin())
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.auth_user_id = (SELECT auth.uid())
        AND (p.id = ANY(team_a) OR p.id = ANY(team_b) OR p.id = creator_id)
    )
  )
  WITH CHECK (
    (SELECT public.is_admin())
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.auth_user_id = (SELECT auth.uid())
        AND (p.id = ANY(team_a) OR p.id = ANY(team_b) OR p.id = creator_id)
    )
  );

ALTER POLICY "Nutzer dürfen eigenes Profil bei Registrierung anlegen"
  ON public.profiles
  WITH CHECK (
    (SELECT auth.uid()) = auth_user_id
    AND (role = 'player' OR (SELECT public.is_master_admin()))
  );

ALTER POLICY "Nutzer dürfen eigenes Profil bearbeiten ohne Rollen-Eskalation"
  ON public.profiles
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

ALTER POLICY "Nur Admins dürfen Whitelist bearbeiten"
  ON public.whitelist
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

ALTER POLICY "Admins und Turnierleiter dürfen Turniere verwalten"
  ON public.tournaments
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

ALTER POLICY "Nur Admins dürfen Einladungscodes anlegen und bearbeiten"
  ON public.invite_codes
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));
