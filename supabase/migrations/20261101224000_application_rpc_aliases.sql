BEGIN;
CREATE OR REPLACE FUNCTION public.consume_invite_code(candidate_code TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor public.profiles; normalized_code TEXT:=upper(trim(candidate_code));
BEGIN
  actor:=public.require_active_player();
  IF normalized_code IS NULL OR normalized_code !~ '^[A-Z0-9_-]{4,64}$' THEN RETURN false; END IF;
  UPDATE public.invite_codes SET used_by=array_append(used_by,actor.auth_user_id)
    WHERE code=normalized_code AND is_active AND NOT actor.auth_user_id=ANY(used_by) AND cardinality(used_by)<max_uses;
  RETURN FOUND;
END;
$$;
CREATE FUNCTION public.set_player_role(p_player_id UUID,p_role TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor public.profiles; target public.profiles; prior TEXT:=current_setting('app.server_operation',true);
BEGIN
  actor:=public.require_active_player();
  SELECT * INTO target FROM public.profiles WHERE id=p_player_id FOR UPDATE;
  IF target.id IS NULL OR actor.role NOT IN ('owner','co_owner') OR target.id=actor.id
    OR target.role='owner' OR p_role IS NULL OR p_role NOT IN ('co_owner','admin','organiser','player')
    OR (actor.role='co_owner' AND (target.role='co_owner' OR p_role='co_owner')) THEN
    RAISE EXCEPTION 'Role change is not permitted';
  END IF;
  PERFORM set_config('app.server_operation','true',true);
  UPDATE public.profiles SET role=p_role,updated_at=now() WHERE id=p_player_id;
  PERFORM set_config('app.server_operation',coalesce(prior,''),true);
END;
$$;
CREATE FUNCTION public.add_whitelist_entry(p_pattern TEXT)
RETURNS public.whitelist LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor public.profiles; pattern TEXT:=lower(trim(p_pattern)); result public.whitelist;
BEGIN
  actor:=public.require_active_player();
  IF actor.role NOT IN ('owner','co_owner','admin') THEN RAISE EXCEPTION 'Administrator required'; END IF;
  IF pattern IS NULL OR length(pattern) NOT BETWEEN 4 AND 254
    OR pattern !~ '^([^@[:space:]%_]+)?@[^@[:space:]%_]+\.[^@[:space:]%_]+$' THEN
    RAISE EXCEPTION 'Invalid email or email domain';
  END IF;
  INSERT INTO public.whitelist(pattern,added_by) VALUES(pattern,actor.id) RETURNING * INTO result;
  RETURN result;
END;
$$;
CREATE FUNCTION public.remove_whitelist_entry(p_entry_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor public.profiles;
BEGIN
  actor:=public.require_active_player();
  IF actor.role NOT IN ('owner','co_owner','admin') THEN RAISE EXCEPTION 'Administrator required'; END IF;
  DELETE FROM public.whitelist WHERE id=p_entry_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Whitelist entry not found'; END IF;
END;
$$;
CREATE FUNCTION public.propose_dispute_resolution(p_match_id UUID,p_score_a INT,p_score_b INT,p_reason TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_score_a IS NULL OR p_score_b IS NULL THEN RAISE EXCEPTION 'Proposed scores required'; END IF;
  PERFORM public.dispute_match(p_match_id,p_reason,p_score_a,p_score_b);
END;
$$;
CREATE FUNCTION public.accept_dispute_resolution(p_match_id UUID,p_score_a INT,p_score_b INT,p_proposed_by UUID)
RETURNS public.matches LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE game public.matches;
BEGIN
  PERFORM pg_advisory_xact_lock(20261101,210000);
  SELECT * INTO game FROM public.matches WHERE id=p_match_id FOR UPDATE;
  IF p_proposed_by IS NULL OR p_proposed_by IS DISTINCT FROM game.dispute_proposed_by
    OR p_score_a IS DISTINCT FROM game.dispute_proposed_score_a
    OR p_score_b IS DISTINCT FROM game.dispute_proposed_score_b THEN RAISE EXCEPTION 'Proposal changed; refresh before accepting'; END IF;
  RETURN public.resolve_match_dispute(p_match_id,p_score_a,p_score_b);
END;
$$;
CREATE FUNCTION public.admin_resolve_dispute(p_match_id UUID,p_action TEXT,p_score_a INT DEFAULT NULL,p_score_b INT DEFAULT NULL)
RETURNS public.matches LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor public.profiles; game public.matches;
BEGIN
  PERFORM pg_advisory_xact_lock(20261101,210000);
  actor:=public.require_active_player();
  IF actor.role NOT IN ('owner','co_owner','admin') THEN RAISE EXCEPTION 'Administrator required'; END IF;
  SELECT * INTO game FROM public.matches WHERE id=p_match_id FOR UPDATE;
  IF game.id IS NULL OR game.status<>'disputed' OR game.tournament_id IS NOT NULL THEN RAISE EXCEPTION 'Disputed league match required'; END IF;
  IF p_action IN ('confirm','keep','confirm_original') THEN
    RETURN public.resolve_match_dispute(p_match_id,game.score_a,game.score_b);
  ELSIF p_action IN ('correct','accept','confirm_correction') THEN
    RETURN public.resolve_match_dispute(p_match_id,p_score_a,p_score_b);
  ELSIF p_action='cancel' THEN
    PERFORM public.cancel_match(p_match_id);
    SELECT * INTO game FROM public.matches WHERE id=p_match_id;
    RETURN game;
  ELSE RAISE EXCEPTION 'Invalid dispute action'; END IF;
END;
$$;
REVOKE INSERT,UPDATE,DELETE ON public.whitelist FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.set_player_role(UUID,TEXT),public.add_whitelist_entry(TEXT),
  public.remove_whitelist_entry(UUID),public.propose_dispute_resolution(UUID,INT,INT,TEXT),
  public.accept_dispute_resolution(UUID,INT,INT,UUID),public.admin_resolve_dispute(UUID,TEXT,INT,INT),
  public.consume_invite_code(TEXT) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_player_role(UUID,TEXT),public.add_whitelist_entry(TEXT),
  public.remove_whitelist_entry(UUID),public.propose_dispute_resolution(UUID,INT,INT,TEXT),
  public.accept_dispute_resolution(UUID,INT,INT,UUID),public.admin_resolve_dispute(UUID,TEXT,INT,INT) TO authenticated;
COMMIT;
