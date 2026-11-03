BEGIN;

CREATE FUNCTION public.delete_player(p_player_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE actor public.profiles; target public.profiles;
BEGIN
  PERFORM pg_advisory_xact_lock(20261101,210000);
  actor := public.require_active_player();
  IF actor.role IS NULL OR actor.role NOT IN ('owner','co_owner') THEN
    RAISE EXCEPTION 'Nur Owner und Co-Owner dürfen Spieler löschen.';
  END IF;
  SELECT * INTO target FROM public.profiles WHERE id=p_player_id FOR UPDATE;
  IF target.id IS NULL THEN RAISE EXCEPTION 'Spieler nicht gefunden.'; END IF;
  IF target.id=actor.id OR target.role='owner' THEN
    RAISE EXCEPTION 'Der eigene Account und Owner-Profile dürfen nicht gelöscht werden.';
  END IF;
  IF EXISTS(SELECT 1 FROM public.matches WHERE p_player_id=ANY(team_a||team_b)
      OR creator_id=p_player_id OR disputed_by=p_player_id OR dispute_proposed_by=p_player_id
      OR cancellation_requested_by=p_player_id OR p_player_id=ANY(confirmed_by))
    OR EXISTS(SELECT 1 FROM public.tournaments WHERE p_player_id=ANY(participants) OR winner_id=p_player_id
      OR EXISTS(SELECT 1 FROM jsonb_array_elements(teams) team
        WHERE team->'playerIds' @> to_jsonb(ARRAY[p_player_id]))
      OR EXISTS(SELECT 1 FROM jsonb_array_elements(matches) fixture
        WHERE fixture->>'playerAId'=p_player_id::TEXT OR fixture->>'playerBId'=p_player_id::TEXT
          OR fixture->>'winnerId'=p_player_id::TEXT)) THEN
    RAISE EXCEPTION 'Spieler mit verknüpften Spielen oder Turnieren können nicht gelöscht werden.';
  END IF;
  IF EXISTS(SELECT 1 FROM public.invite_codes WHERE created_by=p_player_id)
    OR EXISTS(SELECT 1 FROM public.whitelist WHERE added_by=p_player_id) THEN
    RAISE EXCEPTION 'Spieler mit verknüpften Einladungscodes oder Whitelist-Einträgen können nicht gelöscht werden.';
  END IF;
  DELETE FROM public.profiles WHERE id=p_player_id;
END;
$$;

DROP POLICY IF EXISTS "Owner dürfen Spieler löschen" ON public.profiles;
REVOKE DELETE ON public.profiles FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.delete_player(UUID) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.delete_player(UUID) TO authenticated;

COMMIT;
