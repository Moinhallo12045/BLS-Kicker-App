BEGIN;

CREATE OR REPLACE FUNCTION public.submit_match_result(
  p_mode TEXT,p_team_a UUID[],p_team_b UUID[],p_score_a INT,p_score_b INT
)
RETURNS public.matches LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.require_active_player();
  IF p_score_a IS NULL OR p_score_b IS NULL OR p_score_a NOT BETWEEN 0 AND 10 OR p_score_b NOT BETWEEN 0 AND 10 THEN
    RAISE EXCEPTION 'Match scores must be between 0 and 10';
  END IF;
  RETURN public.submit_match_result_internal(p_mode,p_team_a,p_team_b,p_score_a,p_score_b);
END;
$$;

ALTER FUNCTION public.dispute_match(UUID,TEXT,INT,INT) RENAME TO dispute_match_unbounded;
CREATE FUNCTION public.dispute_match(
  p_match_id UUID,p_reason TEXT,p_score_a INT DEFAULT NULL,p_score_b INT DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (p_score_a IS NULL) <> (p_score_b IS NULL)
    OR (p_score_a IS NOT NULL AND (p_score_a NOT BETWEEN 0 AND 10 OR p_score_b NOT BETWEEN 0 AND 10 OR p_score_a=p_score_b)) THEN
    RAISE EXCEPTION 'Proposed scores must be between 0 and 10';
  END IF;
  PERFORM public.dispute_match_unbounded(p_match_id,p_reason,p_score_a,p_score_b);
END;
$$;

ALTER FUNCTION public.resolve_match_dispute(UUID,INT,INT) RENAME TO resolve_match_dispute_unbounded;
CREATE FUNCTION public.resolve_match_dispute(p_match_id UUID,p_score_a INT,p_score_b INT)
RETURNS public.matches LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_score_a IS NULL OR p_score_b IS NULL OR p_score_a NOT BETWEEN 0 AND 10
    OR p_score_b NOT BETWEEN 0 AND 10 OR p_score_a=p_score_b THEN
    RAISE EXCEPTION 'Resolved scores must be between 0 and 10';
  END IF;
  RETURN public.resolve_match_dispute_unbounded(p_match_id,p_score_a,p_score_b);
END;
$$;

ALTER FUNCTION public.score_tournament_match(UUID,TEXT,INT,INT) RENAME TO score_tournament_match_unbounded;
CREATE FUNCTION public.score_tournament_match(
  p_tournament_id UUID,p_match_id TEXT,p_score_a INT,p_score_b INT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE result JSONB; t public.tournaments; idx INT;
BEGIN
  IF p_score_a IS NULL OR p_score_b IS NULL OR p_score_a NOT BETWEEN 0 AND 10
    OR p_score_b NOT BETWEEN 0 AND 10 OR p_score_a=p_score_b THEN
    RAISE EXCEPTION 'Tournament scores must be between 0 and 10';
  END IF;
  result := public.score_tournament_match_unbounded(p_tournament_id,p_match_id,p_score_a,p_score_b);
  SELECT * INTO t FROM public.tournaments WHERE id=p_tournament_id FOR UPDATE;
  SELECT ordinality::INT-1 INTO idx
    FROM jsonb_array_elements(t.matches) WITH ORDINALITY WHERE value->>'id'=p_match_id;
  IF t.type IN ('groups','round_robin') AND t.status='completed' THEN
    SELECT team->>'id' INTO t.winner_team_id
    FROM jsonb_array_elements(t.teams) WITH ORDINALITY AS teams(team,ord)
    ORDER BY
      (SELECT count(*) FROM jsonb_array_elements(t.matches) f WHERE f->>'winnerTeamId'=team->>'id') DESC,
      (SELECT sum(CASE WHEN f->>'teamAId'=team->>'id' THEN (f->>'scoreA')::INT-(f->>'scoreB')::INT
        WHEN f->>'teamBId'=team->>'id' THEN (f->>'scoreB')::INT-(f->>'scoreA')::INT ELSE 0 END)
        FROM jsonb_array_elements(t.matches) f) DESC,
      (SELECT sum(CASE WHEN f->>'teamAId'=team->>'id' THEN (f->>'scoreA')::INT
        WHEN f->>'teamBId'=team->>'id' THEN (f->>'scoreB')::INT ELSE 0 END)
        FROM jsonb_array_elements(t.matches) f) DESC,
      ord LIMIT 1;
    SELECT (team->'playerIds'->>0)::UUID INTO t.winner_id
      FROM jsonb_array_elements(t.teams) team WHERE team->>'id'=t.winner_team_id;
    UPDATE public.tournaments SET winner_team_id=t.winner_team_id,winner_id=t.winner_id,updated_at=now()
      WHERE id=t.id RETURNING * INTO t;
    PERFORM public.refresh_tournament_badges();
  END IF;
  RETURN jsonb_build_object('tournament',to_jsonb(t),'match',t.matches->idx);
END;
$$;

REVOKE ALL ON FUNCTION public.dispute_match_unbounded(UUID,TEXT,INT,INT),
  public.resolve_match_dispute_unbounded(UUID,INT,INT),
  public.score_tournament_match_unbounded(UUID,TEXT,INT,INT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.submit_match_result(TEXT,UUID[],UUID[],INT,INT),
  public.dispute_match(UUID,TEXT,INT,INT),public.resolve_match_dispute(UUID,INT,INT),
  public.score_tournament_match(UUID,TEXT,INT,INT) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.submit_match_result(TEXT,UUID[],UUID[],INT,INT),
  public.dispute_match(UUID,TEXT,INT,INT),public.resolve_match_dispute(UUID,INT,INT),
  public.score_tournament_match(UUID,TEXT,INT,INT) TO authenticated;

COMMIT;
