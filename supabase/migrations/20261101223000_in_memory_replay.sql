BEGIN;
SELECT pg_advisory_xact_lock(20261101,210000);

CREATE FUNCTION public.scoring_delta(p_avg_a NUMERIC,p_avg_b NUMERIC,p_score_a INT,p_score_b INT)
RETURNS INT LANGUAGE sql IMMUTABLE SET search_path = public AS $$
 SELECT round(32*(CASE WHEN p_score_a>p_score_b THEN 1 ELSE 0 END
   - 1/(1+power(10,(p_avg_b-p_avg_a)/400))))::INT
$$;

CREATE FUNCTION public.advance_scoring_state(p public.profiles,p_mode TEXT,p_delta INT,p_won BOOLEAN)
RETURNS public.profiles LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
BEGIN
  p.xp := p.xp+25+CASE WHEN p_won THEN 50 ELSE 0 END;
  WHILE p.xp>=p.xp_next_level AND p.level<50 LOOP
    p.xp := p.xp-p.xp_next_level;
    p.level := p.level+1;
    p.xp_next_level := 100+p.level*25;
  END LOOP;
  IF p_mode='1v1' THEN
    p.elo_1v1:=greatest(100,p.elo_1v1+p_delta);
    p.wins_1v1:=p.wins_1v1+CASE WHEN p_won THEN 1 ELSE 0 END;
    p.losses_1v1:=p.losses_1v1+CASE WHEN p_won THEN 0 ELSE 1 END;
  ELSE
    p.elo_2v2:=greatest(100,p.elo_2v2+p_delta);
    p.wins_2v2:=p.wins_2v2+CASE WHEN p_won THEN 1 ELSE 0 END;
    p.losses_2v2:=p.losses_2v2+CASE WHEN p_won THEN 0 ELSE 1 END;
  END IF;
  p.elo_total:=round((p.elo_1v1+p.elo_2v2)/2.0);
  p.league_points:=p.league_points+CASE WHEN p_won THEN 3 ELSE 0 END;
  p.current_streak:=CASE WHEN p_won THEN p.current_streak+1 ELSE 0 END;
  RETURN p;
END;
$$;

CREATE FUNCTION public.scoring_badges(p public.profiles,p_match public.matches,p_won BOOLEAN,p_revenge BOOLEAN,p_pair_wins INT)
RETURNS JSONB LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE earned TEXT[] := '{}';
BEGIN
  IF p.wins_1v1+p.losses_1v1+p.wins_2v2+p.losses_2v2>=10 THEN earned:=array_append(earned,'stammgast_1'); END IF;
  IF p.wins_1v1+p.wins_2v2>=5 THEN earned:=array_append(earned,'siegertyp_1'); END IF;
  IF p.current_streak>=5 THEN earned:=array_append(earned,'streak_master'); END IF;
  IF p_won AND greatest(p_match.score_a,p_match.score_b)=10 AND least(p_match.score_a,p_match.score_b)<=1 THEN
    earned:=array_append(earned,'clean_sheet'); END IF;
  IF greatest(p.elo_1v1,p.elo_2v2,p.elo_total)>1500 THEN earned:=array_append(earned,'legend_1500'); END IF;
  IF p_won AND p_revenge THEN earned:=array_append(earned,'revanche'); END IF;
  IF p_won AND p_match.mode='2v2' AND p_pair_wins>=3 THEN earned:=array_append(earned,'eingespielt_1'); END IF;
  RETURN (SELECT coalesce(jsonb_agg(DISTINCT badge ORDER BY badge),'[]'::jsonb)
    FROM (SELECT jsonb_array_elements_text(p.badges) badge UNION ALL SELECT unnest(earned)) b);
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_match_core_stats(p_match public.matches)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE avg_a NUMERIC; avg_b NUMERIC; change_a INT; player UUID; p public.profiles; won BOOLEAN;
  prior TEXT := current_setting('app.server_operation',true);
BEGIN
  PERFORM pg_advisory_xact_lock(20261101,210000);
  IF p_match.mode IS NULL OR p_match.mode NOT IN ('1v1','2v2') OR p_match.team_a IS NULL OR p_match.team_b IS NULL
    OR cardinality(p_match.team_a)<>(CASE WHEN p_match.mode='1v1' THEN 1 ELSE 2 END)
    OR cardinality(p_match.team_b)<>(CASE WHEN p_match.mode='1v1' THEN 1 ELSE 2 END)
    OR (SELECT count(DISTINCT x) FROM unnest(p_match.team_a||p_match.team_b)x)<>cardinality(p_match.team_a||p_match.team_b)
    OR (SELECT count(*) FROM public.profiles WHERE id=ANY(p_match.team_a||p_match.team_b))<>cardinality(p_match.team_a||p_match.team_b)
    OR p_match.score_a IS NULL OR p_match.score_b IS NULL OR p_match.score_a<0 OR p_match.score_b<0
    OR p_match.score_a=p_match.score_b OR p_match.created_at IS NULL THEN RAISE EXCEPTION 'Invalid scored match: %',p_match.id; END IF;
  SELECT avg(CASE WHEN p_match.mode='1v1' THEN elo_1v1 ELSE elo_2v2 END) INTO avg_a FROM public.profiles WHERE id=ANY(p_match.team_a);
  SELECT avg(CASE WHEN p_match.mode='1v1' THEN elo_1v1 ELSE elo_2v2 END) INTO avg_b FROM public.profiles WHERE id=ANY(p_match.team_b);
  change_a:=public.scoring_delta(avg_a,avg_b,p_match.score_a,p_match.score_b);
  PERFORM set_config('app.server_operation','true',true);
  FOREACH player IN ARRAY p_match.team_a||p_match.team_b LOOP
    SELECT * INTO p FROM public.profiles WHERE id=player FOR UPDATE;
    won:=(player=ANY(p_match.team_a) AND p_match.score_a>p_match.score_b)
      OR (player=ANY(p_match.team_b) AND p_match.score_b>p_match.score_a);
    p:=public.advance_scoring_state(p,p_match.mode,CASE WHEN player=ANY(p_match.team_a) THEN change_a ELSE -change_a END,won);
    UPDATE public.profiles SET elo_1v1=p.elo_1v1,elo_2v2=p.elo_2v2,elo_total=p.elo_total,
      league_points=p.league_points,wins_1v1=p.wins_1v1,losses_1v1=p.losses_1v1,wins_2v2=p.wins_2v2,
      losses_2v2=p.losses_2v2,current_streak=p.current_streak,xp=p.xp,level=p.level,xp_next_level=p.xp_next_level,
      elo_history=elo_history||jsonb_build_array(jsonb_build_object('date',p_match.created_at::DATE,'elo',p.elo_total)),
      updated_at=now() WHERE id=player;
  END LOOP;
  UPDATE public.matches SET elo_change_a=change_a,elo_change_b=-change_a WHERE id=p_match.id;
  PERFORM set_config('app.server_operation',coalesce(prior,''),true);
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_match_stats(p_match public.matches)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE player UUID; p public.profiles; opponents UUID[]; partners UUID[]; won BOOLEAN;
  revenge BOOLEAN; pair_wins INT; prior TEXT := current_setting('app.server_operation',true);
BEGIN
  PERFORM public.apply_match_core_stats(p_match);
  PERFORM set_config('app.server_operation','true',true);
  FOREACH player IN ARRAY p_match.team_a||p_match.team_b LOOP
    SELECT * INTO p FROM public.profiles WHERE id=player;
    opponents:=CASE WHEN player=ANY(p_match.team_a) THEN p_match.team_b ELSE p_match.team_a END;
    partners:=array_remove(CASE WHEN player=ANY(p_match.team_a) THEN p_match.team_a ELSE p_match.team_b END,player);
    won:=(player=ANY(p_match.team_a) AND p_match.score_a>p_match.score_b)
      OR (player=ANY(p_match.team_b) AND p_match.score_b>p_match.score_a);
    SELECT EXISTS(SELECT 1 FROM public.scoring_losses WHERE player_id=player AND opponent_id=ANY(opponents)) INTO revenge;
    pair_wins:=0;
    IF NOT won THEN INSERT INTO public.scoring_losses SELECT player,unnest(opponents) ON CONFLICT DO NOTHING;
    ELSIF p_match.mode='2v2' THEN
      INSERT INTO public.scoring_partner_wins SELECT player,unnest(partners),1
        ON CONFLICT ON CONSTRAINT scoring_partner_wins_pkey DO UPDATE SET wins=scoring_partner_wins.wins+1;
      SELECT max(wins) INTO pair_wins FROM public.scoring_partner_wins WHERE player_id=player AND partner_id=ANY(partners);
    END IF;
    UPDATE public.profiles SET badges=public.scoring_badges(p,p_match,won,revenge,pair_wins) WHERE id=player;
    INSERT INTO public.scoring_history VALUES(p_match.id,player,p_match.created_at,p.elo_total)
      ON CONFLICT ON CONSTRAINT scoring_history_pkey DO UPDATE SET elo=excluded.elo,played_at=excluded.played_at;
  END LOOP;
  WITH ranked AS (SELECT id,row_number() OVER(ORDER BY elo_total DESC,created_at,id)::INT position FROM public.profiles
    WHERE wins_1v1+losses_1v1+wins_2v2+losses_2v2>=3)
  UPDATE public.profiles ranked_profile SET best_rank=least(coalesce(ranked_profile.best_rank,999),r.position)
    FROM ranked r WHERE r.id=ranked_profile.id;
  PERFORM set_config('app.server_operation',coalesce(prior,''),true);
END;
$$;

CREATE OR REPLACE FUNCTION public.rebuild_match_stats()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE game public.matches; p public.profiles; states JSONB := '{}'; losses JSONB := '{}'; pairs JSONB := '{}';
  player UUID; opponent UUID; partner UUID; opponents UUID[]; partners UUID[]; won BOOLEAN; revenge BOOLEAN;
  pair_wins INT; avg_a NUMERIC; avg_b NUMERIC; change_a INT; pair_key TEXT; ranked RECORD;
  prior TEXT := current_setting('app.server_operation',true);
BEGIN
  PERFORM pg_advisory_xact_lock(20261101,210000);
  PERFORM set_config('app.server_operation','true',true);
  DELETE FROM public.scoring_losses WHERE TRUE;
  DELETE FROM public.scoring_partner_wins WHERE TRUE;
  DELETE FROM public.scoring_history WHERE TRUE;
  FOR p IN SELECT * FROM public.profiles ORDER BY id LOOP
    p.elo_1v1:=1000;p.elo_2v2:=1000;p.elo_total:=1000;p.league_points:=0;
    p.wins_1v1:=0;p.losses_1v1:=0;p.wins_2v2:=0;p.losses_2v2:=0;p.current_streak:=0;
    p.xp:=0;p.level:=1;p.xp_next_level:=150;p.elo_history:='[]';p.best_rank:=999;
    p.badges:=(SELECT coalesce(jsonb_agg(value ORDER BY ordinality),'[]'::jsonb)
      FROM jsonb_array_elements_text(p.badges) WITH ORDINALITY WHERE value NOT IN (
        'stammgast_1','siegertyp_1','revanche','eingespielt_1','streak_master','clean_sheet','legend_1500','turnier_champ'));
    states:=jsonb_set(states,ARRAY[p.id::TEXT],to_jsonb(p));
  END LOOP;
  FOR game IN SELECT * FROM public.matches WHERE result_applied AND status<>'cancelled' ORDER BY created_at,id LOOP
    IF game.mode IS NULL OR game.mode NOT IN ('1v1','2v2') OR game.team_a IS NULL OR game.team_b IS NULL
      OR cardinality(game.team_a)<>(CASE WHEN game.mode='1v1' THEN 1 ELSE 2 END)
      OR cardinality(game.team_b)<>(CASE WHEN game.mode='1v1' THEN 1 ELSE 2 END)
      OR (SELECT count(DISTINCT x) FROM unnest(game.team_a||game.team_b)x)<>cardinality(game.team_a||game.team_b)
      OR EXISTS(SELECT 1 FROM unnest(game.team_a||game.team_b)x WHERE NOT states ? x::TEXT)
      OR game.score_a IS NULL OR game.score_b IS NULL OR game.score_a<0 OR game.score_b<0
      OR game.score_a=game.score_b OR game.created_at IS NULL THEN RAISE EXCEPTION 'Invalid scored match: %',game.id; END IF;
    SELECT avg((states->x::TEXT->>CASE WHEN game.mode='1v1' THEN 'elo_1v1' ELSE 'elo_2v2' END)::NUMERIC)
      INTO avg_a FROM unnest(game.team_a)x;
    SELECT avg((states->x::TEXT->>CASE WHEN game.mode='1v1' THEN 'elo_1v1' ELSE 'elo_2v2' END)::NUMERIC)
      INTO avg_b FROM unnest(game.team_b)x;
    change_a:=public.scoring_delta(avg_a,avg_b,game.score_a,game.score_b);
    FOREACH player IN ARRAY game.team_a||game.team_b LOOP
      p:=jsonb_populate_record(NULL::public.profiles,states->player::TEXT);
      opponents:=CASE WHEN player=ANY(game.team_a) THEN game.team_b ELSE game.team_a END;
      partners:=array_remove(CASE WHEN player=ANY(game.team_a) THEN game.team_a ELSE game.team_b END,player);
      won:=(player=ANY(game.team_a) AND game.score_a>game.score_b) OR (player=ANY(game.team_b) AND game.score_b>game.score_a);
      p:=public.advance_scoring_state(p,game.mode,CASE WHEN player=ANY(game.team_a) THEN change_a ELSE -change_a END,won);
      revenge:=false;pair_wins:=0;
      FOREACH opponent IN ARRAY opponents LOOP
        pair_key:=player::TEXT||':'||opponent::TEXT;
        revenge:=revenge OR losses ? pair_key;
        IF NOT won THEN losses:=jsonb_set(losses,ARRAY[pair_key],'true'); END IF;
      END LOOP;
      IF won AND game.mode='2v2' THEN
        FOREACH partner IN ARRAY partners LOOP
          pair_key:=player::TEXT||':'||partner::TEXT;
          pair_wins:=coalesce((pairs->>pair_key)::INT,0)+1;
          pairs:=jsonb_set(pairs,ARRAY[pair_key],to_jsonb(pair_wins));
        END LOOP;
      END IF;
      p.badges:=public.scoring_badges(p,game,won,revenge,pair_wins);
      states:=jsonb_set(states,ARRAY[player::TEXT],to_jsonb(p));
      INSERT INTO public.scoring_history VALUES(game.id,player,game.created_at,p.elo_total);
    END LOOP;
    FOR ranked IN SELECT key,row_number() OVER(ORDER BY (value->>'elo_total')::INT DESC,
      (value->>'created_at')::TIMESTAMPTZ,key)::INT position FROM jsonb_each(states)
      WHERE (value->>'wins_1v1')::INT+(value->>'losses_1v1')::INT+(value->>'wins_2v2')::INT+(value->>'losses_2v2')::INT>=3 LOOP
      states:=jsonb_set(states,ARRAY[ranked.key,'best_rank'],
        to_jsonb(least((states->ranked.key->>'best_rank')::INT,ranked.position)));
    END LOOP;
    UPDATE public.matches SET elo_change_a=change_a,elo_change_b=-change_a WHERE id=game.id;
  END LOOP;
  INSERT INTO public.scoring_losses SELECT split_part(key,':',1)::UUID,split_part(key,':',2)::UUID FROM jsonb_each(losses);
  INSERT INTO public.scoring_partner_wins SELECT split_part(key,':',1)::UUID,split_part(key,':',2)::UUID,value::INT FROM jsonb_each(pairs);
  FOR p IN SELECT (jsonb_populate_record(NULL::public.profiles,value)).* FROM jsonb_each(states) LOOP
    SELECT coalesce(jsonb_agg(jsonb_build_object('date',played_at::DATE,'elo',elo) ORDER BY played_at,match_id),'[]'::jsonb)
      INTO p.elo_history FROM public.scoring_history WHERE player_id=p.id;
    UPDATE public.profiles SET elo_1v1=p.elo_1v1,elo_2v2=p.elo_2v2,elo_total=p.elo_total,league_points=p.league_points,
      wins_1v1=p.wins_1v1,losses_1v1=p.losses_1v1,wins_2v2=p.wins_2v2,losses_2v2=p.losses_2v2,
      current_streak=p.current_streak,xp=p.xp,level=p.level,xp_next_level=p.xp_next_level,
      elo_history=p.elo_history,badges=p.badges,best_rank=p.best_rank,updated_at=now() WHERE id=p.id;
  END LOOP;
  PERFORM public.refresh_tournament_badges();
  PERFORM set_config('app.server_operation',coalesce(prior,''),true);
END;
$$;
CREATE INDEX scoring_history_player_order_idx ON public.scoring_history(player_id,played_at,match_id);
REVOKE ALL ON FUNCTION public.scoring_delta(NUMERIC,NUMERIC,INT,INT),
  public.advance_scoring_state(public.profiles,TEXT,INT,BOOLEAN),
  public.scoring_badges(public.profiles,public.matches,BOOLEAN,BOOLEAN,INT) FROM PUBLIC,anon,authenticated;
SELECT public.rebuild_match_stats();
COMMIT;
