CREATE OR REPLACE FUNCTION public.submit_match_result(
  p_mode TEXT,
  p_team_a UUID[],
  p_team_b UUID[],
  p_score_a INT,
  p_score_b INT
)
RETURNS public.matches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_profile UUID;
  new_match public.matches;
  avg_a NUMERIC;
  avg_b NUMERIC;
  expected_a NUMERIC;
  actual_a NUMERIC;
  change_a INT;
  change_b INT;
  player_id UUID;
  won BOOLEAN;
  delta INT;
  current_xp INT;
  current_level INT;
  next_xp INT;
BEGIN
  PERFORM set_config('app.server_operation', 'true', true);
  SELECT id INTO actor_profile
  FROM public.profiles
  WHERE auth_user_id = auth.uid();

  IF actor_profile IS NULL THEN
    RAISE EXCEPTION 'A linked player profile is required';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = actor_profile AND is_suspended
  ) THEN
    RAISE EXCEPTION 'Suspended players cannot submit matches';
  END IF;
  IF p_mode NOT IN ('1v1', '2v2')
     OR cardinality(p_team_a) <> (CASE WHEN p_mode = '1v1' THEN 1 ELSE 2 END)
     OR cardinality(p_team_b) <> (CASE WHEN p_mode = '1v1' THEN 1 ELSE 2 END)
     OR cardinality(p_team_a) <> cardinality(ARRAY(SELECT DISTINCT value FROM unnest(p_team_a) AS value))
     OR cardinality(p_team_b) <> cardinality(ARRAY(SELECT DISTINCT value FROM unnest(p_team_b) AS value))
     OR p_team_a && p_team_b
     OR NOT (actor_profile = ANY(p_team_a) OR actor_profile = ANY(p_team_b))
     OR p_score_a < 0 OR p_score_b < 0
     OR p_score_a = p_score_b
     OR (SELECT count(*) FROM public.profiles WHERE id = ANY(p_team_a || p_team_b))
        <> cardinality(p_team_a) + cardinality(p_team_b)
     OR EXISTS (
       SELECT 1 FROM public.profiles
       WHERE id = ANY(p_team_a || p_team_b) AND is_suspended
     ) THEN
    RAISE EXCEPTION 'Invalid match result';
  END IF;

  SELECT COALESCE(AVG(CASE WHEN p_mode = '1v1' THEN elo_1v1 ELSE elo_2v2 END), 1000)
    INTO avg_a FROM public.profiles WHERE id = ANY(p_team_a);
  SELECT COALESCE(AVG(CASE WHEN p_mode = '1v1' THEN elo_1v1 ELSE elo_2v2 END), 1000)
    INTO avg_b FROM public.profiles WHERE id = ANY(p_team_b);

  expected_a := 1 / (1 + power(10, (avg_b - avg_a) / 400));
  actual_a := CASE WHEN p_score_a > p_score_b THEN 1 ELSE 0 END;
  change_a := round(32 * (actual_a - expected_a));
  change_b := -change_a;

  INSERT INTO public.matches (
    mode, creator_id, team_a, team_b, score_a, score_b, status,
    confirmed_by, elo_change_a, elo_change_b, result_applied
  )
  VALUES (
    p_mode, actor_profile, p_team_a, p_team_b, p_score_a, p_score_b,
    'confirmed', ARRAY[actor_profile]::UUID[], change_a, change_b, TRUE
  )
  RETURNING * INTO new_match;

  FOREACH player_id IN ARRAY p_team_a || p_team_b LOOP
    won := (player_id = ANY(p_team_a) AND p_score_a > p_score_b)
        OR (player_id = ANY(p_team_b) AND p_score_b > p_score_a);
    delta := CASE WHEN player_id = ANY(p_team_a) THEN change_a ELSE change_b END;

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
      elo_1v1 = CASE WHEN p_mode = '1v1' THEN GREATEST(100, elo_1v1 + delta) ELSE elo_1v1 END,
      elo_2v2 = CASE WHEN p_mode = '2v2' THEN GREATEST(100, elo_2v2 + delta) ELSE elo_2v2 END,
      elo_total = round((
        (CASE WHEN p_mode = '1v1' THEN GREATEST(100, elo_1v1 + delta) ELSE elo_1v1 END) +
        (CASE WHEN p_mode = '2v2' THEN GREATEST(100, elo_2v2 + delta) ELSE elo_2v2 END)
      ) / 2),
      league_points = league_points + CASE WHEN won THEN 3 ELSE 0 END,
      wins_1v1 = wins_1v1 + CASE WHEN p_mode = '1v1' AND won THEN 1 ELSE 0 END,
      losses_1v1 = losses_1v1 + CASE WHEN p_mode = '1v1' AND NOT won THEN 1 ELSE 0 END,
      wins_2v2 = wins_2v2 + CASE WHEN p_mode = '2v2' AND won THEN 1 ELSE 0 END,
      losses_2v2 = losses_2v2 + CASE WHEN p_mode = '2v2' AND NOT won THEN 1 ELSE 0 END,
      current_streak = CASE WHEN won THEN current_streak + 1 ELSE 0 END,
      xp = current_xp,
      level = current_level,
      xp_next_level = next_xp,
      elo_history = elo_history || jsonb_build_array(jsonb_build_object(
        'date', CURRENT_DATE,
        'elo', round((
          (CASE WHEN p_mode = '1v1' THEN GREATEST(100, elo_1v1 + delta) ELSE elo_1v1 END) +
          (CASE WHEN p_mode = '2v2' THEN GREATEST(100, elo_2v2 + delta) ELSE elo_2v2 END)
        ) / 2
      ))),
      updated_at = NOW()
    WHERE id = player_id;
  END LOOP;

  RETURN new_match;
END;
$$;

CREATE OR REPLACE FUNCTION public.acknowledge_match(p_match_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_profile UUID;
BEGIN
  PERFORM set_config('app.server_operation', 'true', true);
  SELECT id INTO actor_profile
  FROM public.profiles
  WHERE auth_user_id = auth.uid() AND NOT is_suspended;
  IF actor_profile IS NULL THEN
    RAISE EXCEPTION 'Suspended or unlinked players cannot acknowledge matches';
  END IF;
  UPDATE public.matches
  SET confirmed_by = ARRAY(
    SELECT DISTINCT value
    FROM unnest(array_append(confirmed_by, actor_profile)) AS value
  ), updated_at = NOW()
  WHERE id = p_match_id
    AND actor_profile = ANY(team_a || team_b)
    AND status IN ('pending', 'confirmed');
END;
$$;

CREATE OR REPLACE FUNCTION public.dispute_match(
  p_match_id UUID,
  p_reason TEXT,
  p_score_a INT DEFAULT NULL,
  p_score_b INT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_profile UUID;
BEGIN
  PERFORM set_config('app.server_operation', 'true', true);
  SELECT id INTO actor_profile
  FROM public.profiles
  WHERE auth_user_id = auth.uid() AND NOT is_suspended;
  IF actor_profile IS NULL OR length(trim(coalesce(p_reason, ''))) = 0 THEN
    RAISE EXCEPTION 'A player and dispute reason are required';
  END IF;
  UPDATE public.matches
  SET status = 'disputed',
      disputed_by = actor_profile,
      dispute_reason = trim(p_reason),
      updated_at = NOW()
  WHERE id = p_match_id
    AND actor_profile = ANY(team_a || team_b)
    AND status <> 'cancelled';
END;
$$;
