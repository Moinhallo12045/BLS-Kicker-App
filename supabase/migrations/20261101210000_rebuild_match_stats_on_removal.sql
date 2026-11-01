BEGIN;

SELECT pg_advisory_xact_lock(20261101, 210000);

-- Acquire this lock before row locks, including for bulk DELETE and direct UPDATE.
CREATE OR REPLACE FUNCTION public.serialize_match_stats_writes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(20261101, 210000);
  RETURN NULL;
END;
$$;

CREATE TRIGGER serialize_match_stats_writes
BEFORE INSERT OR UPDATE OR DELETE ON public.matches
FOR EACH STATEMENT
EXECUTE FUNCTION public.serialize_match_stats_writes();

-- Submission and replay must use exactly the same rating and XP rules.
CREATE OR REPLACE FUNCTION public.apply_match_stats(p_match public.matches)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  avg_a NUMERIC;
  avg_b NUMERIC;
  change_a INT;
  change_b INT;
  player_id UUID;
  won BOOLEAN;
  delta INT;
  current_xp INT;
  current_level INT;
  next_xp INT;
  server_operation TEXT := current_setting('app.server_operation', true);
BEGIN
  PERFORM pg_advisory_xact_lock(20261101, 210000);
  IF p_match.mode IS NULL OR p_match.mode NOT IN ('1v1', '2v2')
     OR p_match.team_a IS NULL OR p_match.team_b IS NULL
     OR cardinality(p_match.team_a) <> (CASE WHEN p_match.mode = '1v1' THEN 1 ELSE 2 END)
     OR cardinality(p_match.team_b) <> (CASE WHEN p_match.mode = '1v1' THEN 1 ELSE 2 END)
     OR p_match.team_a && p_match.team_b
     OR (SELECT count(DISTINCT value) FROM unnest(p_match.team_a || p_match.team_b) AS value)
        <> cardinality(p_match.team_a) + cardinality(p_match.team_b)
     OR (SELECT count(*) FROM public.profiles WHERE id = ANY(p_match.team_a || p_match.team_b))
        <> cardinality(p_match.team_a) + cardinality(p_match.team_b)
     OR p_match.score_a IS NULL OR p_match.score_b IS NULL
     OR p_match.score_a < 0 OR p_match.score_b < 0 OR p_match.score_a = p_match.score_b
     OR p_match.created_at IS NULL THEN
    RAISE EXCEPTION 'Invalid scored match: %', p_match.id;
  END IF;
  PERFORM set_config('app.server_operation', 'true', true);

  SELECT AVG(CASE WHEN p_match.mode = '1v1' THEN elo_1v1 ELSE elo_2v2 END)
    INTO avg_a FROM public.profiles WHERE id = ANY(p_match.team_a);
  SELECT AVG(CASE WHEN p_match.mode = '1v1' THEN elo_1v1 ELSE elo_2v2 END)
    INTO avg_b FROM public.profiles WHERE id = ANY(p_match.team_b);
  change_a := round(32 * (
    CASE WHEN p_match.score_a > p_match.score_b THEN 1 ELSE 0 END
    - 1 / (1 + power(10, (avg_b - avg_a) / 400))
  ));
  change_b := -change_a;

  FOREACH player_id IN ARRAY p_match.team_a || p_match.team_b LOOP
    won := (player_id = ANY(p_match.team_a) AND p_match.score_a > p_match.score_b)
        OR (player_id = ANY(p_match.team_b) AND p_match.score_b > p_match.score_a);
    delta := CASE WHEN player_id = ANY(p_match.team_a) THEN change_a ELSE change_b END;
    SELECT xp, level, xp_next_level
      INTO current_xp, current_level, next_xp
    FROM public.profiles WHERE id = player_id FOR UPDATE;

    current_xp := current_xp + 25 + CASE WHEN won THEN 50 ELSE 0 END;
    WHILE current_xp >= next_xp AND current_level < 50 LOOP
      current_xp := current_xp - next_xp;
      current_level := current_level + 1;
      next_xp := 100 + current_level * 25;
    END LOOP;

    UPDATE public.profiles
    SET
      elo_1v1 = CASE WHEN p_match.mode = '1v1' THEN GREATEST(100, elo_1v1 + delta) ELSE elo_1v1 END,
      elo_2v2 = CASE WHEN p_match.mode = '2v2' THEN GREATEST(100, elo_2v2 + delta) ELSE elo_2v2 END,
      elo_total = round((
        (CASE WHEN p_match.mode = '1v1' THEN GREATEST(100, elo_1v1 + delta) ELSE elo_1v1 END) +
        (CASE WHEN p_match.mode = '2v2' THEN GREATEST(100, elo_2v2 + delta) ELSE elo_2v2 END)
      ) / 2),
      league_points = league_points + CASE WHEN won THEN 3 ELSE 0 END,
      wins_1v1 = wins_1v1 + CASE WHEN p_match.mode = '1v1' AND won THEN 1 ELSE 0 END,
      losses_1v1 = losses_1v1 + CASE WHEN p_match.mode = '1v1' AND NOT won THEN 1 ELSE 0 END,
      wins_2v2 = wins_2v2 + CASE WHEN p_match.mode = '2v2' AND won THEN 1 ELSE 0 END,
      losses_2v2 = losses_2v2 + CASE WHEN p_match.mode = '2v2' AND NOT won THEN 1 ELSE 0 END,
      current_streak = CASE WHEN won THEN current_streak + 1 ELSE 0 END,
      xp = current_xp,
      level = current_level,
      xp_next_level = next_xp,
      elo_history = elo_history || jsonb_build_array(jsonb_build_object(
        'date', p_match.created_at::DATE,
        'elo', round((
          (CASE WHEN p_match.mode = '1v1' THEN GREATEST(100, elo_1v1 + delta) ELSE elo_1v1 END) +
          (CASE WHEN p_match.mode = '2v2' THEN GREATEST(100, elo_2v2 + delta) ELSE elo_2v2 END)
        ) / 2)
      )),
      updated_at = NOW()
    WHERE id = player_id;
  END LOOP;

  UPDATE public.matches
  SET elo_change_a = change_a, elo_change_b = change_b
  WHERE id = p_match.id;
  PERFORM set_config('app.server_operation', coalesce(server_operation, ''), true);
END;
$$;

CREATE OR REPLACE FUNCTION public.rebuild_match_stats()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  scored_match public.matches;
  server_operation TEXT := current_setting('app.server_operation', true);
BEGIN
  PERFORM pg_advisory_xact_lock(20261101, 210000);
  PERFORM set_config('app.server_operation', 'true', true);
  UPDATE public.profiles
  SET elo_1v1 = 1000, elo_2v2 = 1000, elo_total = 1000,
      league_points = 0, wins_1v1 = 0, losses_1v1 = 0,
      wins_2v2 = 0, losses_2v2 = 0, current_streak = 0,
      xp = 0, level = 1, xp_next_level = 150,
      elo_history = '[]'::jsonb, updated_at = NOW();

  FOR scored_match IN
    SELECT * FROM public.matches
    WHERE result_applied AND status <> 'cancelled'
    ORDER BY created_at, id
  LOOP
    PERFORM public.apply_match_stats(scored_match);
  END LOOP;
  PERFORM set_config('app.server_operation', coalesce(server_operation, ''), true);
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_match_result(
  p_mode TEXT, p_team_a UUID[], p_team_b UUID[], p_score_a INT, p_score_b INT
)
RETURNS public.matches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_profile UUID;
  new_match public.matches;
  server_operation TEXT := current_setting('app.server_operation', true);
BEGIN
  PERFORM pg_advisory_xact_lock(20261101, 210000);
  SELECT id INTO actor_profile FROM public.profiles WHERE auth_user_id = auth.uid();
  IF actor_profile IS NULL THEN
    RAISE EXCEPTION 'A linked player profile is required';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = actor_profile AND is_suspended) THEN
    RAISE EXCEPTION 'Suspended players cannot submit matches';
  END IF;
  IF p_mode IS NULL OR p_mode NOT IN ('1v1', '2v2')
     OR p_team_a IS NULL OR p_team_b IS NULL
     OR NOT coalesce(actor_profile = ANY(p_team_a || p_team_b), FALSE)
     OR EXISTS (SELECT 1 FROM public.profiles WHERE id = ANY(p_team_a || p_team_b) AND is_suspended) THEN
    RAISE EXCEPTION 'Invalid match result';
  END IF;
  PERFORM set_config('app.server_operation', 'true', true);
  INSERT INTO public.matches (
    mode, creator_id, team_a, team_b, score_a, score_b, status, confirmed_by, result_applied, created_at
  )
  VALUES (
    p_mode, actor_profile, p_team_a, p_team_b, p_score_a, p_score_b,
    'confirmed', ARRAY[actor_profile]::UUID[], TRUE, clock_timestamp()
  )
  RETURNING * INTO new_match;
  PERFORM public.apply_match_stats(new_match);
  SELECT * INTO new_match FROM public.matches WHERE id = new_match.id;
  PERFORM set_config('app.server_operation', coalesce(server_operation, ''), true);
  RETURN new_match;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_match(p_match_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_profile UUID;
  cancelled_match public.matches;
  server_operation TEXT := current_setting('app.server_operation', true);
BEGIN
  PERFORM pg_advisory_xact_lock(20261101, 210000);
  SELECT id INTO actor_profile FROM public.profiles WHERE auth_user_id = auth.uid();
  SELECT * INTO cancelled_match FROM public.matches WHERE id = p_match_id FOR UPDATE;
  IF cancelled_match.id IS NULL THEN
    RAISE EXCEPTION 'Match not found';
  END IF;
  IF NOT coalesce(
    public.is_admin() OR actor_profile = ANY(cancelled_match.team_a || cancelled_match.team_b),
    FALSE
  ) THEN
    RAISE EXCEPTION 'Only match participants or admins can cancel this match';
  END IF;
  IF cancelled_match.status = 'cancelled' THEN
    RETURN;
  END IF;
  PERFORM set_config('app.server_operation', 'true', true);
  UPDATE public.matches
  SET status = 'cancelled', result_applied = FALSE,
      elo_change_a = 0, elo_change_b = 0, updated_at = NOW()
  WHERE id = p_match_id;
  PERFORM set_config('app.server_operation', coalesce(server_operation, ''), true);
END;
$$;

CREATE OR REPLACE FUNCTION public.rebuild_match_stats_after_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM deleted_matches WHERE result_applied AND status <> 'cancelled') THEN
    PERFORM public.rebuild_match_stats();
  END IF;
  RETURN NULL;
END;
$$;

-- Score corrections and direct cancellation must also update derived statistics.
CREATE OR REPLACE FUNCTION public.rebuild_match_stats_after_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM previous_matches old_match JOIN updated_matches new_match USING (id)
    WHERE (old_match.result_applied OR new_match.result_applied)
      AND (
        old_match.result_applied IS DISTINCT FROM new_match.result_applied
        OR (old_match.status = 'cancelled') IS DISTINCT FROM (new_match.status = 'cancelled')
        OR ROW(old_match.mode, old_match.team_a, old_match.team_b,
               old_match.score_a, old_match.score_b, old_match.created_at)
           IS DISTINCT FROM
           ROW(new_match.mode, new_match.team_a, new_match.team_b,
               new_match.score_a, new_match.score_b, new_match.created_at)
      )
  ) THEN
    PERFORM public.rebuild_match_stats();
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS rollback_match_stats_on_delete ON public.matches;
DROP FUNCTION IF EXISTS public.rollback_match_stats_before_delete();

-- result_applied was added after client-side scoring: recover scored legacy rows.
DO $$
DECLARE
  server_operation TEXT := current_setting('app.server_operation', true);
BEGIN
  PERFORM set_config('app.server_operation', 'true', true);
  UPDATE public.matches
  SET result_applied = TRUE
  WHERE NOT result_applied AND status <> 'cancelled'
    AND (status = 'confirmed' OR elo_change_a <> 0 OR elo_change_b <> 0);
  UPDATE public.matches
  SET result_applied = FALSE, elo_change_a = 0, elo_change_b = 0
  WHERE status = 'cancelled';
  PERFORM set_config('app.server_operation', coalesce(server_operation, ''), true);
END;
$$;

CREATE TRIGGER rebuild_match_stats_on_delete
AFTER DELETE ON public.matches
REFERENCING OLD TABLE AS deleted_matches
FOR EACH STATEMENT
EXECUTE FUNCTION public.rebuild_match_stats_after_delete();

CREATE TRIGGER rebuild_match_stats_on_update
AFTER UPDATE ON public.matches
REFERENCING OLD TABLE AS previous_matches NEW TABLE AS updated_matches
FOR EACH STATEMENT
EXECUTE FUNCTION public.rebuild_match_stats_after_update();

REVOKE ALL ON FUNCTION public.serialize_match_stats_writes() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_match_stats(public.matches) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rebuild_match_stats() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rebuild_match_stats_after_delete() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rebuild_match_stats_after_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_match_result(TEXT, UUID[], UUID[], INT, INT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_match(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_match_result(TEXT, UUID[], UUID[], INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_match(UUID) TO authenticated;

SELECT public.rebuild_match_stats();

COMMIT;
