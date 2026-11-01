CREATE OR REPLACE FUNCTION public.cancel_match(p_match_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_profile UUID;
  cancelled_match public.matches;
  player_id UUID;
  in_team_a BOOLEAN;
  won BOOLEAN;
  elo_delta INT;
BEGIN
  PERFORM set_config('app.server_operation', 'true', true);

  SELECT id INTO actor_profile
  FROM public.profiles
  WHERE auth_user_id = auth.uid();

  SELECT *
  INTO cancelled_match
  FROM public.matches
  WHERE id = p_match_id
  FOR UPDATE;

  IF cancelled_match.id IS NULL THEN
    RAISE EXCEPTION 'Match not found';
  END IF;
  IF NOT (
    public.is_admin()
    OR actor_profile = ANY(cancelled_match.team_a || cancelled_match.team_b)
  ) THEN
    RAISE EXCEPTION 'Only match participants or admins can cancel this match';
  END IF;

  IF cancelled_match.status = 'cancelled' THEN
    RETURN;
  END IF;

  IF cancelled_match.result_applied THEN
    FOREACH player_id IN ARRAY cancelled_match.team_a || cancelled_match.team_b LOOP
      in_team_a := player_id = ANY(cancelled_match.team_a);
      won := (in_team_a AND cancelled_match.score_a > cancelled_match.score_b)
        OR (NOT in_team_a AND cancelled_match.score_b > cancelled_match.score_a);
      elo_delta := CASE
        WHEN in_team_a THEN cancelled_match.elo_change_a
        ELSE cancelled_match.elo_change_b
      END;

      UPDATE public.profiles
      SET
        elo_1v1 = CASE
          WHEN cancelled_match.mode = '1v1' THEN GREATEST(100, elo_1v1 - elo_delta)
          ELSE elo_1v1
        END,
        elo_2v2 = CASE
          WHEN cancelled_match.mode = '2v2' THEN GREATEST(100, elo_2v2 - elo_delta)
          ELSE elo_2v2
        END,
        elo_total = round((
          (CASE
            WHEN cancelled_match.mode = '1v1' THEN GREATEST(100, elo_1v1 - elo_delta)
            ELSE elo_1v1
          END) +
          (CASE
            WHEN cancelled_match.mode = '2v2' THEN GREATEST(100, elo_2v2 - elo_delta)
            ELSE elo_2v2
          END)
        ) / 2),
        league_points = GREATEST(0, league_points - CASE WHEN won THEN 3 ELSE 0 END),
        wins_1v1 = wins_1v1 - CASE WHEN cancelled_match.mode = '1v1' AND won THEN 1 ELSE 0 END,
        losses_1v1 = losses_1v1 - CASE WHEN cancelled_match.mode = '1v1' AND NOT won THEN 1 ELSE 0 END,
        wins_2v2 = wins_2v2 - CASE WHEN cancelled_match.mode = '2v2' AND won THEN 1 ELSE 0 END,
        losses_2v2 = losses_2v2 - CASE WHEN cancelled_match.mode = '2v2' AND NOT won THEN 1 ELSE 0 END,
        updated_at = NOW()
      WHERE id = player_id;
    END LOOP;
  END IF;

  UPDATE public.matches
  SET
    status = 'cancelled',
    result_applied = FALSE,
    elo_change_a = 0,
    elo_change_b = 0,
    updated_at = NOW()
  WHERE id = p_match_id;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_match(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_match(UUID) TO authenticated;
