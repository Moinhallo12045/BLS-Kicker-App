BEGIN;

REVOKE INSERT, UPDATE, DELETE ON public.matches FROM PUBLIC, anon, authenticated;
REVOKE INSERT, DELETE ON public.profiles FROM PUBLIC, anon, authenticated;
REVOKE SELECT ON public.profiles FROM PUBLIC, anon, authenticated;
REVOKE SELECT (email,auth_user_id) ON public.profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, name, avatar, year_joined, level, xp, xp_next_level,
  elo_1v1, elo_2v2, elo_total, league_points, wins_1v1, losses_1v1,
  wins_2v2, losses_2v2, current_streak, best_rank, role, is_suspended,
  badges, elo_history, created_at, updated_at) ON public.profiles TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS public.profiles LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT p FROM public.profiles p WHERE p.auth_user_id = auth.uid() $$;

CREATE OR REPLACE FUNCTION public.require_active_player()
RETURNS public.profiles LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE actor public.profiles;
BEGIN
  SELECT * INTO actor FROM public.profiles WHERE auth_user_id = auth.uid() AND NOT is_suspended;
  IF actor.id IS NULL THEN RAISE EXCEPTION 'A linked nonsuspended player is required'; END IF;
  RETURN actor;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.profiles
  WHERE auth_user_id = auth.uid() AND NOT is_suspended AND role IN ('owner','co_owner','admin')) $$;
CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.profiles
  WHERE auth_user_id = auth.uid() AND NOT is_suspended AND role = 'owner') $$;

CREATE OR REPLACE FUNCTION public.prevent_profile_tampering()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE actor public.profiles;
BEGIN
  IF current_setting('app.server_operation', true) = 'true' THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.id IS DISTINCT FROM auth.uid() OR NEW.auth_user_id IS DISTINCT FROM auth.uid()
      OR NEW.role IS DISTINCT FROM 'player'
      OR lower(NEW.email) IS DISTINCT FROM lower(auth.jwt()->>'email')
      OR NEW.is_suspended IS DISTINCT FROM FALSE
      OR ROW(NEW.level,NEW.xp,NEW.xp_next_level,NEW.elo_1v1,NEW.elo_2v2,NEW.elo_total,
        NEW.league_points,NEW.wins_1v1,NEW.losses_1v1,NEW.wins_2v2,NEW.losses_2v2,
        NEW.current_streak,NEW.best_rank,NEW.badges,NEW.elo_history)
        IS DISTINCT FROM ROW(1,0,150,1000,1000,1000,0,0,0,0,0,0,999,'[]'::jsonb,'[]'::jsonb)
      OR NOT EXISTS (SELECT 1 FROM public.whitelist WHERE lower(pattern)=lower(NEW.email)
        OR (left(pattern,1)='@' AND lower(NEW.email) LIKE '%'||lower(pattern))) THEN
      RAISE EXCEPTION 'Invalid profile registration';
    END IF;
    RETURN NEW;
  END IF;
  actor := public.require_active_player();
  IF (to_jsonb(NEW) - ARRAY['name','avatar','year_joined','role','updated_at'])
       IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['name','avatar','year_joined','role','updated_at']) THEN
    RAISE EXCEPTION 'Profile identity and statistics are server-managed';
  END IF;
  IF NEW.role IS DISTINCT FROM OLD.role AND (
    actor.role NOT IN ('owner','co_owner') OR OLD.id=actor.id
    OR OLD.role='owner' OR NEW.role IS NULL OR NEW.role='owner'
    OR (actor.role='co_owner' AND (OLD.role='co_owner' OR NEW.role='co_owner'))
  ) THEN RAISE EXCEPTION 'Role change is not permitted'; END IF;
  IF NEW.name IS NULL OR length(trim(NEW.name)) NOT BETWEEN 1 AND 80
     OR NEW.year_joined IS NULL OR NEW.year_joined NOT BETWEEN 2000 AND extract(year FROM current_date)::INT THEN
    RAISE EXCEPTION 'Invalid player details';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS prevent_profile_tampering ON public.profiles;
DROP TRIGGER IF EXISTS protect_profile_fields ON public.profiles;
CREATE TRIGGER prevent_profile_tampering BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_tampering();
DROP POLICY IF EXISTS "Nutzer dürfen eigenes Profil bearbeiten ohne Rollen-Eskalation" ON public.profiles;
CREATE POLICY "Nutzer dürfen eigenes Profil bearbeiten ohne Rollen-Eskalation" ON public.profiles
FOR UPDATE TO authenticated
USING (id=(SELECT (public.get_my_profile()).id) OR (SELECT public.is_admin()))
WITH CHECK (id=(SELECT (public.get_my_profile()).id) OR (SELECT public.is_admin()));

CREATE OR REPLACE FUNCTION public.validate_match_write()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF current_setting('app.server_operation',true) IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'Matches must be changed through server RPCs';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_player_suspension(p_player_id UUID,p_suspended BOOLEAN)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE actor public.profiles; target public.profiles; prior TEXT := current_setting('app.server_operation',true);
BEGIN
  actor := public.require_active_player();
  SELECT * INTO target FROM public.profiles WHERE id=p_player_id FOR UPDATE;
  IF target.id IS NULL OR p_suspended IS NULL OR actor.role NOT IN ('owner','co_owner','admin')
    OR target.id=actor.id OR target.role='owner'
    OR (actor.role='admin' AND target.role IN ('co_owner','admin'))
    OR (actor.role='co_owner' AND target.role='co_owner') THEN
    RAISE EXCEPTION 'Suspension is not permitted';
  END IF;
  PERFORM set_config('app.server_operation','true',true);
  UPDATE public.profiles SET is_suspended=p_suspended,updated_at=now() WHERE id=p_player_id;
  PERFORM set_config('app.server_operation',coalesce(prior,''),true);
END;
$$;

ALTER TABLE public.matches ADD COLUMN cancellation_requested_by UUID REFERENCES public.profiles(id);

CREATE OR REPLACE FUNCTION public.acknowledge_match(p_match_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE actor public.profiles; game public.matches; prior TEXT := current_setting('app.server_operation',true);
BEGIN
  actor := public.require_active_player();
  SELECT * INTO game FROM public.matches WHERE id=p_match_id FOR UPDATE;
  IF game.id IS NULL OR game.tournament_id IS NOT NULL OR game.status NOT IN ('pending','confirmed')
    OR NOT coalesce(actor.id=ANY(game.team_a||game.team_b),false) THEN RAISE EXCEPTION 'Cannot acknowledge this match'; END IF;
  PERFORM set_config('app.server_operation','true',true);
  UPDATE public.matches SET confirmed_by=ARRAY(SELECT DISTINCT unnest(game.confirmed_by||ARRAY[actor.id])),
    updated_at=now() WHERE id=p_match_id;
  PERFORM set_config('app.server_operation',coalesce(prior,''),true);
END;
$$;

CREATE OR REPLACE FUNCTION public.dispute_match(p_match_id UUID,p_reason TEXT,p_score_a INT DEFAULT NULL,p_score_b INT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE actor public.profiles; game public.matches; prior TEXT := current_setting('app.server_operation',true);
BEGIN
  PERFORM pg_advisory_xact_lock(20261101,210000);
  actor := public.require_active_player();
  SELECT * INTO game FROM public.matches WHERE id=p_match_id FOR UPDATE;
  IF game.id IS NULL OR game.tournament_id IS NOT NULL OR game.status='cancelled'
    OR NOT coalesce(actor.id=ANY(game.team_a||game.team_b),false)
    OR length(trim(coalesce(p_reason,''))) NOT BETWEEN 1 AND 1000
    OR (p_score_a IS NULL)<>(p_score_b IS NULL)
    OR (p_score_a IS NOT NULL AND (p_score_a NOT BETWEEN 0 AND 100 OR p_score_b NOT BETWEEN 0 AND 100 OR p_score_a=p_score_b)) THEN
    RAISE EXCEPTION 'Invalid dispute';
  END IF;
  PERFORM set_config('app.server_operation','true',true);
  UPDATE public.matches SET status='disputed',disputed_by=actor.id,dispute_reason=trim(p_reason),
    dispute_proposed_by=actor.id,dispute_proposed_score_a=p_score_a,dispute_proposed_score_b=p_score_b,
    updated_at=now() WHERE id=p_match_id;
  PERFORM set_config('app.server_operation',coalesce(prior,''),true);
END;
$$;

CREATE FUNCTION public.resolve_match_dispute(p_match_id UUID,p_score_a INT,p_score_b INT)
RETURNS public.matches LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE actor public.profiles; game public.matches; proposer UUID; prior TEXT := current_setting('app.server_operation',true);
BEGIN
  PERFORM pg_advisory_xact_lock(20261101,210000);
  actor := public.require_active_player();
  SELECT * INTO game FROM public.matches WHERE id=p_match_id FOR UPDATE;
  proposer := game.dispute_proposed_by;
  IF game.id IS NULL OR game.tournament_id IS NOT NULL OR game.status<>'disputed'
    OR p_score_a IS NULL OR p_score_b IS NULL OR p_score_a NOT BETWEEN 0 AND 100
    OR p_score_b NOT BETWEEN 0 AND 100 OR p_score_a=p_score_b THEN RAISE EXCEPTION 'Invalid dispute resolution'; END IF;
  IF actor.role NOT IN ('owner','co_owner','admin') AND (
    proposer IS NULL OR p_score_a IS DISTINCT FROM game.dispute_proposed_score_a
    OR p_score_b IS DISTINCT FROM game.dispute_proposed_score_b
    OR NOT coalesce((proposer=ANY(game.team_a) AND actor.id=ANY(game.team_b))
      OR (proposer=ANY(game.team_b) AND actor.id=ANY(game.team_a)),false)
  ) THEN RAISE EXCEPTION 'Opponent agreement or administrator required'; END IF;
  PERFORM set_config('app.server_operation','true',true);
  UPDATE public.matches SET score_a=p_score_a,score_b=p_score_b,status='confirmed',result_applied=true,
    confirmed_by=ARRAY[proposer,actor.id],disputed_by=NULL,dispute_reason=NULL,
    dispute_proposed_by=NULL,dispute_proposed_score_a=NULL,dispute_proposed_score_b=NULL,
    cancellation_requested_by=NULL,updated_at=now() WHERE id=p_match_id;
  SELECT * INTO game FROM public.matches WHERE id=p_match_id;
  PERFORM set_config('app.server_operation',coalesce(prior,''),true);
  RETURN game;
END;
$$;

CREATE FUNCTION public.accept_match_proposal(p_match_id UUID)
RETURNS public.matches LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE game public.matches;
BEGIN
  SELECT * INTO game FROM public.matches WHERE id=p_match_id;
  RETURN public.resolve_match_dispute(p_match_id,game.dispute_proposed_score_a,game.dispute_proposed_score_b);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_match(p_match_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE actor public.profiles; game public.matches; fixture_id TEXT; prior TEXT := current_setting('app.server_operation',true);
BEGIN
  PERFORM pg_advisory_xact_lock(20261101,210000);
  actor := public.require_active_player();
  SELECT * INTO game FROM public.matches WHERE id=p_match_id FOR UPDATE;
  IF game.id IS NULL THEN RAISE EXCEPTION 'Match not found'; END IF;
  IF actor.role NOT IN ('owner','co_owner','admin') AND
    NOT coalesce(actor.id=ANY(game.team_a||game.team_b),false) THEN RAISE EXCEPTION 'Not a participant'; END IF;
  IF game.tournament_id IS NOT NULL THEN
    IF actor.role NOT IN ('owner','co_owner','admin') THEN RAISE EXCEPTION 'Tournament results require an administrator or organiser'; END IF;
    SELECT fixture->>'id' INTO fixture_id FROM public.tournaments t,
      LATERAL jsonb_array_elements(t.matches) fixture
      WHERE t.id=game.tournament_id AND fixture->>'leagueMatchId'=game.id::TEXT;
    IF fixture_id IS NULL THEN RAISE EXCEPTION 'Linked tournament fixture not found'; END IF;
    PERFORM public.reset_tournament_match(game.tournament_id,fixture_id);
    RETURN;
  END IF;
  IF game.status='cancelled' THEN RETURN; END IF;
  PERFORM set_config('app.server_operation','true',true);
  IF actor.role IN ('owner','co_owner','admin') OR coalesce(
    (game.cancellation_requested_by=ANY(game.team_a) AND actor.id=ANY(game.team_b))
    OR (game.cancellation_requested_by=ANY(game.team_b) AND actor.id=ANY(game.team_a)),false) THEN
    UPDATE public.matches SET status='cancelled',result_applied=false,elo_change_a=0,elo_change_b=0,
      updated_at=now() WHERE id=p_match_id;
  ELSIF game.cancellation_requested_by IS NULL THEN
    UPDATE public.matches SET cancellation_requested_by=actor.id,updated_at=now() WHERE id=p_match_id;
  END IF;
  PERFORM set_config('app.server_operation',coalesce(prior,''),true);
END;
$$;

CREATE FUNCTION public.create_invite_code(p_code TEXT,p_max_uses INT)
RETURNS public.invite_codes LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE actor public.profiles; result public.invite_codes; normalized_code TEXT := upper(trim(p_code));
BEGIN
  actor := public.require_active_player();
  IF actor.role NOT IN ('owner','co_owner','admin') THEN RAISE EXCEPTION 'Administrator required'; END IF;
  IF normalized_code IS NULL OR normalized_code !~ '^[A-Z0-9_-]{4,64}$' OR p_max_uses IS NULL OR p_max_uses NOT BETWEEN 1 AND 10000 THEN
    RAISE EXCEPTION 'Invalid invite code or use limit';
  END IF;
  IF EXISTS(SELECT 1 FROM public.invite_codes i WHERE i.code=normalized_code) THEN RAISE EXCEPTION 'Invite code already exists'; END IF;
  INSERT INTO public.invite_codes(code,created_by,max_uses) VALUES(normalized_code,actor.id,p_max_uses) RETURNING * INTO result;
  RETURN result;
END;
$$;
REVOKE INSERT,UPDATE,DELETE ON public.invite_codes FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.require_active_player() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.get_my_profile(), public.resolve_match_dispute(UUID,INT,INT),
  public.accept_match_proposal(UUID),public.create_invite_code(TEXT,INT) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_my_profile(),public.resolve_match_dispute(UUID,INT,INT),
  public.accept_match_proposal(UUID),public.create_invite_code(TEXT,INT) TO authenticated;
REVOKE ALL ON FUNCTION public.set_player_suspension(UUID,BOOLEAN),public.acknowledge_match(UUID),
  public.dispute_match(UUID,TEXT,INT,INT) FROM PUBLIC,anon;

COMMIT;
