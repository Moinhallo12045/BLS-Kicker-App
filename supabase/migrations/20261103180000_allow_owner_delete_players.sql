BEGIN;

GRANT DELETE ON public.profiles TO authenticated;

DROP POLICY IF EXISTS "Owner dürfen Spieler löschen" ON public.profiles;
CREATE POLICY "Owner dürfen Spieler löschen"
  ON public.profiles
  FOR DELETE
  TO authenticated
  USING (
    (SELECT public.is_owner())
    AND id <> (SELECT auth.uid())
    AND role <> 'owner'
  );

COMMIT;
