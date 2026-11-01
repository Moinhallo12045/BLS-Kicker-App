BEGIN;
ALTER TABLE public.tournaments
  ADD COLUMN teams JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN winner_team_id TEXT,
  ADD COLUMN created_by UUID REFERENCES public.profiles(id),
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
REVOKE INSERT,UPDATE,DELETE ON public.tournaments FROM PUBLIC,anon,authenticated;
CREATE INDEX IF NOT EXISTS matches_tournament_id_idx ON public.matches(tournament_id);

CREATE FUNCTION public.check_tournament_actor()
RETURNS public.profiles LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE actor public.profiles;
BEGIN
  actor := public.require_active_player();
  IF actor.role NOT IN ('owner','co_owner','admin','organiser') THEN RAISE EXCEPTION 'Tournament organiser required'; END IF;
  RETURN actor;
END;
$$;

CREATE FUNCTION public.refresh_tournament_badges()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE prior TEXT := current_setting('app.server_operation',true);
BEGIN
  PERFORM set_config('app.server_operation','true',true);
  UPDATE public.profiles p SET badges=(
    SELECT coalesce(jsonb_agg(DISTINCT badge ORDER BY badge),'[]'::jsonb) FROM (
      SELECT value badge FROM jsonb_array_elements_text(p.badges) WHERE value<>'turnier_champ'
      UNION ALL SELECT 'turnier_champ' WHERE EXISTS (
        SELECT 1 FROM public.tournaments t WHERE t.status='completed' AND (
          (t.winner_team_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM jsonb_array_elements(t.teams) team WHERE team->>'id'=t.winner_team_id
              AND team->'playerIds' @> to_jsonb(ARRAY[p.id])))
          OR (t.winner_team_id IS NULL AND t.winner_id=p.id))
      )
    ) earned
  );
  PERFORM set_config('app.server_operation',coalesce(prior,''),true);
END;
$$;

CREATE FUNCTION public.create_tournament(p_name TEXT,p_description TEXT,p_type TEXT,p_mode TEXT,p_teams JSONB)
RETURNS public.tournaments LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE actor public.profiles; result public.tournaments; team JSONB; fixtures JSONB := '[]';
  players UUID[] := '{}'; ids TEXT[] := '{}'; team_players UUID[]; n INT; r INT; i INT; j INT; rounds INT;
BEGIN
  actor := public.check_tournament_actor();
  IF p_name IS NULL OR length(trim(p_name)) NOT BETWEEN 1 AND 120 OR length(coalesce(p_description,''))>4000
    OR p_type IS NULL OR p_type NOT IN ('ko','groups','round_robin')
    OR p_mode IS NULL OR p_mode NOT IN ('1v1','2v2')
    OR p_teams IS NULL OR jsonb_typeof(p_teams)<>'array' THEN RAISE EXCEPTION 'Invalid tournament'; END IF;
  n := jsonb_array_length(p_teams);
  IF n NOT BETWEEN 2 AND 64 OR (p_type='ko' AND n NOT IN (2,4,8,16,32,64)) THEN RAISE EXCEPTION 'Invalid team count'; END IF;
  FOR team IN SELECT value FROM jsonb_array_elements(p_teams) LOOP
    IF jsonb_typeof(team)<>'object' OR nullif(team->>'id','') IS NULL
      OR length(team->>'id')>64 OR (team->>'id')=ANY(ids)
      OR jsonb_typeof(team->'playerIds') IS DISTINCT FROM 'array'
      OR jsonb_array_length(team->'playerIds')<>(CASE WHEN p_mode='1v1' THEN 1 ELSE 2 END) THEN
      RAISE EXCEPTION 'Invalid fixed team';
    END IF;
    SELECT array_agg(value::UUID) INTO team_players FROM jsonb_array_elements_text(team->'playerIds');
    IF (SELECT count(DISTINCT x) FROM unnest(team_players) x)<>cardinality(team_players)
      OR players && team_players
      OR (SELECT count(*) FROM public.profiles WHERE id=ANY(team_players) AND NOT is_suspended)<>cardinality(team_players) THEN
      RAISE EXCEPTION 'Players must exist, be active, and occur in one team only';
    END IF;
    players := players||team_players; ids := array_append(ids,team->>'id');
  END LOOP;
  IF p_type='ko' THEN
    rounds := log(2,n)::INT;
    FOR r IN 1..rounds LOOP
      FOR i IN 0..(n/(2^r)::INT)-1 LOOP
        fixtures := fixtures||jsonb_build_array(jsonb_build_object('id',gen_random_uuid()::TEXT,'round',r,
          'teamAId',CASE WHEN r=1 THEN ids[i*2+1] END,'teamBId',CASE WHEN r=1 THEN ids[i*2+2] END,
          'playerAId',CASE WHEN r=1 THEN p_teams->(i*2)->'playerIds'->>0 END,
          'playerBId',CASE WHEN r=1 THEN p_teams->(i*2+1)->'playerIds'->>0 END,
          'scoreA',NULL,'scoreB',NULL,'winnerId',NULL,'winnerTeamId',NULL,'status','pending','leagueMatchId',NULL));
      END LOOP;
    END LOOP;
  ELSE
    -- Groups use a single all-play-all group, with deterministic fixture order.
    FOR i IN 1..n-1 LOOP
      FOR j IN i+1..n LOOP
        fixtures := fixtures||jsonb_build_array(jsonb_build_object('id',gen_random_uuid()::TEXT,'round',1,
          'teamAId',ids[i],'teamBId',ids[j],'playerAId',p_teams->(i-1)->'playerIds'->>0,
          'playerBId',p_teams->(j-1)->'playerIds'->>0,'scoreA',NULL,'scoreB',NULL,
          'winnerId',NULL,'winnerTeamId',NULL,'status','pending','leagueMatchId',NULL));
      END LOOP;
    END LOOP;
  END IF;
  INSERT INTO public.tournaments(name,description,type,mode,teams,participants,matches,created_by)
    VALUES(trim(p_name),p_description,p_type,p_mode,p_teams,players,fixtures,actor.id) RETURNING * INTO result;
  RETURN result;
END;
$$;

CREATE FUNCTION public.reset_tournament_match(p_tournament_id UUID,p_match_id TEXT)
RETURNS public.tournaments LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE t public.tournaments; fixture JSONB; target INT; idx INT; next_idx INT;
  round_no INT; pos INT; count_round INT; league_ids UUID[] := '{}';
  prior TEXT := current_setting('app.server_operation',true);
BEGIN
  PERFORM pg_advisory_xact_lock(20261101,210000);
  PERFORM public.check_tournament_actor();
  SELECT * INTO t FROM public.tournaments WHERE id=p_tournament_id FOR UPDATE;
  IF t.id IS NULL THEN RAISE EXCEPTION 'Tournament not found'; END IF;
  SELECT ordinality::INT-1 INTO target FROM jsonb_array_elements(t.matches) WITH ORDINALITY WHERE value->>'id'=p_match_id;
  IF target IS NULL THEN RAISE EXCEPTION 'Tournament match not found'; END IF;
  idx := target;
  LOOP
    fixture := t.matches->idx;
    IF nullif(fixture->>'leagueMatchId','') IS NOT NULL THEN
      league_ids := array_append(league_ids,(fixture->>'leagueMatchId')::UUID);
    END IF;
    t.matches := jsonb_set(t.matches,ARRAY[idx::TEXT],fixture||jsonb_build_object(
      'scoreA',NULL,'scoreB',NULL,'winnerId',NULL,'winnerTeamId',NULL,'status','pending','leagueMatchId',NULL));
    EXIT WHEN t.type<>'ko';
    round_no := (fixture->>'round')::INT;
    SELECT count(*)::INT INTO count_round FROM jsonb_array_elements(t.matches) f WHERE (f->>'round')::INT=round_no;
    EXIT WHEN count_round=1;
    SELECT count(*)::INT INTO pos FROM jsonb_array_elements(t.matches) WITH ORDINALITY f
      WHERE (value->>'round')::INT=round_no AND ordinality-1<idx;
    SELECT ordinality::INT-1 INTO next_idx FROM jsonb_array_elements(t.matches) WITH ORDINALITY
      WHERE (value->>'round')::INT=round_no+1 ORDER BY ordinality OFFSET (pos/2) LIMIT 1;
    t.matches := jsonb_set(t.matches,ARRAY[next_idx::TEXT],
      (t.matches->next_idx)||jsonb_build_object(CASE WHEN pos%2=0 THEN 'teamAId' ELSE 'teamBId' END,NULL,
        CASE WHEN pos%2=0 THEN 'playerAId' ELSE 'playerBId' END,NULL));
    idx := next_idx;
  END LOOP;
  PERFORM set_config('app.server_operation','true',true);
  UPDATE public.tournaments SET matches=t.matches,winner_team_id=NULL,winner_id=NULL,
    status=CASE WHEN EXISTS(SELECT 1 FROM jsonb_array_elements(t.matches) f WHERE f->>'status'='completed')
      THEN 'running' ELSE 'upcoming' END,updated_at=now() WHERE id=t.id RETURNING * INTO t;
  UPDATE public.matches SET status='cancelled',result_applied=false,elo_change_a=0,elo_change_b=0,updated_at=now()
    WHERE id=ANY(league_ids);
  PERFORM public.refresh_tournament_badges();
  PERFORM set_config('app.server_operation',coalesce(prior,''),true);
  RETURN t;
END;
$$;

CREATE FUNCTION public.score_tournament_match(p_tournament_id UUID,p_match_id TEXT,p_score_a INT,p_score_b INT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE actor public.profiles; t public.tournaments; fixture JSONB; idx INT; next_idx INT;
  a UUID[]; b UUID[]; winner TEXT; game public.matches; round_no INT; pos INT;
  prior TEXT := current_setting('app.server_operation',true);
BEGIN
  PERFORM pg_advisory_xact_lock(20261101,210000);
  actor := public.check_tournament_actor();
  IF p_score_a IS NULL OR p_score_b IS NULL OR p_score_a NOT BETWEEN 0 AND 100
    OR p_score_b NOT BETWEEN 0 AND 100 OR p_score_a=p_score_b THEN RAISE EXCEPTION 'Invalid tournament score'; END IF;
  SELECT * INTO t FROM public.tournaments WHERE id=p_tournament_id FOR UPDATE;
  SELECT ordinality::INT-1 INTO idx FROM jsonb_array_elements(t.matches) WITH ORDINALITY WHERE value->>'id'=p_match_id;
  IF t.id IS NULL OR idx IS NULL THEN RAISE EXCEPTION 'Tournament match not found'; END IF;
  fixture := t.matches->idx;
  IF fixture->>'status'='completed' AND (fixture->>'scoreA')::INT=p_score_a AND (fixture->>'scoreB')::INT=p_score_b THEN
    RETURN jsonb_build_object('tournament',to_jsonb(t),'match',fixture);
  END IF;
  SELECT array_agg(member::UUID) INTO a FROM jsonb_array_elements(t.teams) team,
    LATERAL jsonb_array_elements_text(team->'playerIds') member WHERE team->>'id'=fixture->>'teamAId';
  SELECT array_agg(member::UUID) INTO b FROM jsonb_array_elements(t.teams) team,
    LATERAL jsonb_array_elements_text(team->'playerIds') member WHERE team->>'id'=fixture->>'teamBId';
  IF a IS NULL OR b IS NULL OR a && b
    OR cardinality(a)<>(CASE WHEN t.mode='1v1' THEN 1 ELSE 2 END)
    OR cardinality(b)<>(CASE WHEN t.mode='1v1' THEN 1 ELSE 2 END)
    OR (SELECT count(*) FROM public.profiles WHERE id=ANY(a||b) AND NOT is_suspended)<>cardinality(a||b) THEN
    RAISE EXCEPTION 'Fixture teams are not ready or contain suspended players';
  END IF;
  IF fixture->>'status'='completed' THEN
    t := public.reset_tournament_match(t.id,p_match_id); fixture := t.matches->idx;
  END IF;
  PERFORM set_config('app.server_operation','true',true);
  INSERT INTO public.matches(mode,creator_id,team_a,team_b,score_a,score_b,status,confirmed_by,result_applied,tournament_id,created_at)
    VALUES(t.mode,actor.id,a,b,p_score_a,p_score_b,'confirmed',a||b,true,t.id,clock_timestamp()) RETURNING * INTO game;
  PERFORM public.apply_match_stats(game);
  winner := CASE WHEN p_score_a>p_score_b THEN fixture->>'teamAId' ELSE fixture->>'teamBId' END;
  fixture := fixture||jsonb_build_object('scoreA',p_score_a,'scoreB',p_score_b,'status','completed',
    'winnerId',CASE WHEN t.mode='1v1' THEN CASE WHEN p_score_a>p_score_b THEN a[1] ELSE b[1] END END,
    'winnerTeamId',winner,'leagueMatchId',game.id::TEXT);
  t.matches := jsonb_set(t.matches,ARRAY[idx::TEXT],fixture);
  IF t.type='ko' THEN
    round_no := (fixture->>'round')::INT;
    SELECT count(*)::INT INTO pos FROM jsonb_array_elements(t.matches) WITH ORDINALITY
      WHERE (value->>'round')::INT=round_no AND ordinality-1<idx;
    SELECT ordinality::INT-1 INTO next_idx FROM jsonb_array_elements(t.matches) WITH ORDINALITY
      WHERE (value->>'round')::INT=round_no+1 ORDER BY ordinality OFFSET (pos/2) LIMIT 1;
    IF next_idx IS NOT NULL THEN
      t.matches := jsonb_set(t.matches,ARRAY[next_idx::TEXT],(t.matches->next_idx)||jsonb_build_object(
        CASE WHEN pos%2=0 THEN 'teamAId' ELSE 'teamBId' END,winner,
        CASE WHEN pos%2=0 THEN 'playerAId' ELSE 'playerBId' END,
        CASE WHEN p_score_a>p_score_b THEN a[1] ELSE b[1] END));
    ELSE t.winner_team_id := winner; END IF;
  ELSIF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(t.matches) f WHERE f->>'status'<>'completed') THEN
    SELECT team->>'id' INTO t.winner_team_id FROM jsonb_array_elements(t.teams) WITH ORDINALITY teams(team,ord)
    ORDER BY (SELECT count(*) FROM jsonb_array_elements(t.matches) f WHERE f->>'winnerTeamId'=team->>'id') DESC,
      (SELECT sum(CASE WHEN f->>'teamAId'=team->>'id' THEN (f->>'scoreA')::INT-(f->>'scoreB')::INT
        WHEN f->>'teamBId'=team->>'id' THEN (f->>'scoreB')::INT-(f->>'scoreA')::INT ELSE 0 END)
        FROM jsonb_array_elements(t.matches) f) DESC,ord LIMIT 1;
  END IF;
  SELECT (team->'playerIds'->>0)::UUID INTO t.winner_id FROM jsonb_array_elements(t.teams) team WHERE team->>'id'=t.winner_team_id;
  UPDATE public.tournaments SET matches=t.matches,winner_team_id=t.winner_team_id,winner_id=t.winner_id,
    status=CASE WHEN t.winner_team_id IS NULL THEN 'running' ELSE 'completed' END,updated_at=now()
    WHERE id=t.id RETURNING * INTO t;
  PERFORM public.refresh_tournament_badges();
  PERFORM set_config('app.server_operation',coalesce(prior,''),true);
  RETURN jsonb_build_object('tournament',to_jsonb(t),'match',fixture);
END;
$$;

CREATE FUNCTION public.remove_tournament(p_tournament_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE prior TEXT := current_setting('app.server_operation',true);
BEGIN
  PERFORM pg_advisory_xact_lock(20261101,210000);
  PERFORM public.check_tournament_actor();
  PERFORM 1 FROM public.tournaments WHERE id=p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tournament not found'; END IF;
  PERFORM set_config('app.server_operation','true',true);
  DELETE FROM public.tournaments WHERE id=p_tournament_id;
  UPDATE public.matches SET status='cancelled',result_applied=false,elo_change_a=0,elo_change_b=0,
    tournament_id=NULL,updated_at=now() WHERE tournament_id=p_tournament_id;
  PERFORM public.refresh_tournament_badges();
  PERFORM set_config('app.server_operation',coalesce(prior,''),true);
END;
$$;
REVOKE ALL ON FUNCTION public.check_tournament_actor(),public.refresh_tournament_badges() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.create_tournament(TEXT,TEXT,TEXT,TEXT,JSONB),
  public.score_tournament_match(UUID,TEXT,INT,INT),public.reset_tournament_match(UUID,TEXT),
  public.remove_tournament(UUID) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_tournament(TEXT,TEXT,TEXT,TEXT,JSONB),
  public.score_tournament_match(UUID,TEXT,INT,INT),public.reset_tournament_match(UUID,TEXT),
  public.remove_tournament(UUID) TO authenticated;
SELECT public.refresh_tournament_badges();
COMMIT;
