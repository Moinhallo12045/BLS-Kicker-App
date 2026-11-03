BEGIN;
SELECT pg_advisory_xact_lock(20261101,210000);
CREATE TABLE public.scoring_losses (
  player_id UUID NOT NULL, opponent_id UUID NOT NULL, PRIMARY KEY(player_id,opponent_id)
);
CREATE TABLE public.scoring_partner_wins (
  player_id UUID NOT NULL, partner_id UUID NOT NULL, wins INT NOT NULL, PRIMARY KEY(player_id,partner_id)
);
CREATE TABLE public.scoring_history (
  match_id UUID NOT NULL, player_id UUID NOT NULL, played_at TIMESTAMPTZ NOT NULL,
  elo INT NOT NULL, PRIMARY KEY(match_id,player_id)
);
REVOKE ALL ON public.scoring_losses,public.scoring_partner_wins,public.scoring_history FROM PUBLIC,anon,authenticated;
ALTER TABLE public.scoring_losses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scoring_partner_wins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scoring_history ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE definition TEXT;
BEGIN
  definition := pg_get_functiondef('public.apply_match_core_stats(public.matches)'::regprocedure);
  definition := replace(definition,') / 2)',') / 2.0)');
  definition := replace(definition,') / 2' || chr(10),') / 2.0' || chr(10));
  definition := replace(definition,'elo_history = elo_history || jsonb_build_array(jsonb_build_object(',
    'elo_history = CASE WHEN current_setting(''app.replaying'',true) = ''true'' THEN elo_history ELSE elo_history || jsonb_build_array(jsonb_build_object(');
  definition := replace(definition,'      )),' || chr(10) || '      updated_at',
    '      )) END,' || chr(10) || '      updated_at');
  EXECUTE definition;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_match_stats(p_match public.matches)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE player_id UUID; p public.profiles; opponents UUID[]; partners UUID[]; won BOOLEAN;
  earned TEXT[]; prior TEXT := current_setting('app.server_operation',true);
BEGIN
  PERFORM public.apply_match_core_stats(p_match);
  PERFORM set_config('app.server_operation','true',true);
  FOREACH player_id IN ARRAY p_match.team_a||p_match.team_b LOOP
    SELECT * INTO p FROM public.profiles WHERE id=player_id;
    opponents := CASE WHEN player_id=ANY(p_match.team_a) THEN p_match.team_b ELSE p_match.team_a END;
    partners := array_remove(CASE WHEN player_id=ANY(p_match.team_a) THEN p_match.team_a ELSE p_match.team_b END,player_id);
    won := (player_id=ANY(p_match.team_a) AND p_match.score_a>p_match.score_b)
      OR (player_id=ANY(p_match.team_b) AND p_match.score_b>p_match.score_a);
    earned := '{}';
    IF p.wins_1v1+p.losses_1v1+p.wins_2v2+p.losses_2v2>=10 THEN earned:=array_append(earned,'stammgast_1'); END IF;
    IF p.wins_1v1+p.wins_2v2>=5 THEN earned:=array_append(earned,'siegertyp_1'); END IF;
    IF p.current_streak>=5 THEN earned:=array_append(earned,'streak_master'); END IF;
    IF won AND greatest(p_match.score_a,p_match.score_b)=10 AND least(p_match.score_a,p_match.score_b)<=1 THEN
      earned:=array_append(earned,'clean_sheet');
    END IF;
    IF greatest(p.elo_1v1,p.elo_2v2,p.elo_total)>1500 THEN earned:=array_append(earned,'legend_1500'); END IF;
    IF won AND EXISTS(SELECT 1 FROM public.scoring_losses l WHERE l.player_id=p.id AND opponent_id=ANY(opponents)) THEN
      earned:=array_append(earned,'revanche');
    END IF;
    IF NOT won THEN
      INSERT INTO public.scoring_losses SELECT p.id,unnest(opponents) ON CONFLICT DO NOTHING;
    ELSIF p_match.mode='2v2' THEN
      INSERT INTO public.scoring_partner_wins SELECT p.id,unnest(partners),1
        ON CONFLICT ON CONSTRAINT scoring_partner_wins_pkey DO UPDATE SET wins=scoring_partner_wins.wins+1;
      IF EXISTS(SELECT 1 FROM public.scoring_partner_wins w WHERE w.player_id=p.id AND partner_id=ANY(partners) AND wins>=3) THEN
        earned:=array_append(earned,'eingespielt_1');
      END IF;
    END IF;
    UPDATE public.profiles SET badges=(SELECT coalesce(jsonb_agg(DISTINCT badge ORDER BY badge),'[]'::jsonb)
      FROM (SELECT jsonb_array_elements_text(p.badges) badge UNION ALL SELECT unnest(earned)) b) WHERE id=p.id;
    INSERT INTO public.scoring_history VALUES(p_match.id,p.id,p_match.created_at,p.elo_total)
      ON CONFLICT ON CONSTRAINT scoring_history_pkey DO UPDATE SET elo=excluded.elo,played_at=excluded.played_at;
  END LOOP;
  WITH ranked AS (
    SELECT id,row_number() OVER(ORDER BY elo_total DESC,created_at,id)::INT position FROM public.profiles
    WHERE wins_1v1+losses_1v1+wins_2v2+losses_2v2>=3
  ) UPDATE public.profiles ranked_profile SET best_rank=least(coalesce(ranked_profile.best_rank,999),r.position)
    FROM ranked r WHERE r.id=ranked_profile.id;
  PERFORM set_config('app.server_operation',coalesce(prior,''),true);
END;
$$;

CREATE OR REPLACE FUNCTION public.rebuild_match_stats()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE game public.matches; prior TEXT := current_setting('app.server_operation',true);
  replay_prior TEXT := current_setting('app.replaying',true);
BEGIN
  PERFORM pg_advisory_xact_lock(20261101,210000);
  PERFORM set_config('app.server_operation','true',true);
  PERFORM set_config('app.replaying','true',true);
  DELETE FROM public.scoring_losses WHERE TRUE;
  DELETE FROM public.scoring_partner_wins WHERE TRUE;
  DELETE FROM public.scoring_history WHERE TRUE;
  UPDATE public.profiles p SET elo_1v1=1000,elo_2v2=1000,elo_total=1000,league_points=0,
    wins_1v1=0,losses_1v1=0,wins_2v2=0,losses_2v2=0,current_streak=0,xp=0,level=1,
    xp_next_level=150,elo_history='[]',best_rank=999,badges=(
      SELECT coalesce(jsonb_agg(value ORDER BY ordinality),'[]'::jsonb)
      FROM jsonb_array_elements_text(p.badges) WITH ORDINALITY
      WHERE value NOT IN ('stammgast_1','siegertyp_1','revanche','eingespielt_1','streak_master',
        'clean_sheet','legend_1500','turnier_champ')
    ),updated_at=now();
  FOR game IN SELECT * FROM public.matches WHERE result_applied AND status<>'cancelled' ORDER BY created_at,id LOOP
    PERFORM public.apply_match_stats(game);
  END LOOP;
  UPDATE public.profiles p SET elo_history=h.history FROM (
    SELECT player_id,jsonb_agg(jsonb_build_object('date',played_at::DATE,'elo',elo) ORDER BY played_at,match_id) history
    FROM public.scoring_history GROUP BY player_id
  ) h WHERE h.player_id=p.id;
  PERFORM public.refresh_tournament_badges();
  PERFORM set_config('app.replaying',coalesce(replay_prior,''),true);
  PERFORM set_config('app.server_operation',coalesce(prior,''),true);
END;
$$;

-- Keep the existing submission contract, while validating every participant
-- before the scoring function acquires its server-operation capability.
ALTER FUNCTION public.submit_match_result(TEXT,UUID[],UUID[],INT,INT) RENAME TO submit_match_result_internal;
CREATE FUNCTION public.submit_match_result(p_mode TEXT,p_team_a UUID[],p_team_b UUID[],p_score_a INT,p_score_b INT)
RETURNS public.matches LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.require_active_player();
  IF p_score_a IS NULL OR p_score_b IS NULL OR p_score_a NOT BETWEEN 0 AND 100 OR p_score_b NOT BETWEEN 0 AND 100 THEN
    RAISE EXCEPTION 'Invalid match score';
  END IF;
  RETURN public.submit_match_result_internal(p_mode,p_team_a,p_team_b,p_score_a,p_score_b);
END;
$$;
REVOKE ALL ON FUNCTION public.submit_match_result_internal(TEXT,UUID[],UUID[],INT,INT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.submit_match_result(TEXT,UUID[],UUID[],INT,INT) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.submit_match_result(TEXT,UUID[],UUID[],INT,INT) TO authenticated;
SELECT public.rebuild_match_stats();
COMMIT;
