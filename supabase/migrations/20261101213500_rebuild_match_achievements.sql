BEGIN;

SELECT pg_advisory_xact_lock(20261101, 210000);

ALTER FUNCTION public.apply_match_stats(public.matches) RENAME TO apply_match_core_stats;

CREATE FUNCTION public.apply_match_stats(p_match public.matches)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  player_id UUID;
  player_profile public.profiles;
  opponents UUID[];
  partners UUID[];
  won BOOLEAN;
  earned_badges TEXT[];
  server_operation TEXT := current_setting('app.server_operation', true);
BEGIN
  PERFORM public.apply_match_core_stats(p_match);
  PERFORM set_config('app.server_operation', 'true', true);
  FOREACH player_id IN ARRAY p_match.team_a || p_match.team_b LOOP
    SELECT * INTO player_profile FROM public.profiles WHERE id = player_id;
    opponents := CASE WHEN player_id = ANY(p_match.team_a) THEN p_match.team_b ELSE p_match.team_a END;
    partners := array_remove(
      CASE WHEN player_id = ANY(p_match.team_a) THEN p_match.team_a ELSE p_match.team_b END,
      player_id
    );
    won := (player_id = ANY(p_match.team_a) AND p_match.score_a > p_match.score_b)
        OR (player_id = ANY(p_match.team_b) AND p_match.score_b > p_match.score_a);
    earned_badges := ARRAY[]::TEXT[];

    IF player_profile.wins_1v1 + player_profile.losses_1v1
       + player_profile.wins_2v2 + player_profile.losses_2v2 >= 10 THEN
      earned_badges := array_append(earned_badges, 'stammgast_1');
    END IF;
    IF player_profile.wins_1v1 + player_profile.wins_2v2 >= 5 THEN
      earned_badges := array_append(earned_badges, 'siegertyp_1');
    END IF;
    IF player_profile.current_streak >= 5 THEN
      earned_badges := array_append(earned_badges, 'streak_master');
    END IF;
    IF won AND greatest(p_match.score_a, p_match.score_b) = 10
       AND least(p_match.score_a, p_match.score_b) <= 1 THEN
      earned_badges := array_append(earned_badges, 'clean_sheet');
    END IF;
    IF greatest(player_profile.elo_1v1, player_profile.elo_2v2, player_profile.elo_total) > 1500 THEN
      earned_badges := array_append(earned_badges, 'legend_1500');
    END IF;
    IF won AND EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.result_applied AND m.status <> 'cancelled'
        AND (m.created_at, m.id) < (p_match.created_at, p_match.id)
        AND (
          (player_id = ANY(m.team_a) AND m.score_a < m.score_b AND m.team_b && opponents)
          OR (player_id = ANY(m.team_b) AND m.score_b < m.score_a AND m.team_a && opponents)
        )
    ) THEN
      earned_badges := array_append(earned_badges, 'revanche');
    END IF;
    IF won AND p_match.mode = '2v2' AND (
      SELECT count(*) FROM public.matches m
      WHERE m.result_applied AND m.status <> 'cancelled' AND m.mode = '2v2'
        AND (m.created_at, m.id) <= (p_match.created_at, p_match.id)
        AND (
          (player_id = ANY(m.team_a) AND partners <@ m.team_a AND m.score_a > m.score_b)
          OR (player_id = ANY(m.team_b) AND partners <@ m.team_b AND m.score_b > m.score_a)
        )
    ) >= 3 THEN
      earned_badges := array_append(earned_badges, 'eingespielt_1');
    END IF;

    UPDATE public.profiles
    SET badges = (
      SELECT coalesce(jsonb_agg(badge ORDER BY badge), '[]'::jsonb)
      FROM (
        SELECT DISTINCT badge
        FROM (
          SELECT value AS badge FROM jsonb_array_elements_text(coalesce(player_profile.badges, '[]'::jsonb))
          UNION ALL
          SELECT unnest(earned_badges)
        ) candidates
      ) unique_badges
    )
    WHERE id = player_id;
  END LOOP;

  -- Like the main ELO leaderboard: qualify after three games, break ties by
  -- profile creation order, then UUID for deterministic replay.
  WITH ranked AS (
    SELECT id, row_number() OVER (ORDER BY elo_total DESC, created_at, id)::INT AS position
    FROM public.profiles
    WHERE wins_1v1 + losses_1v1 + wins_2v2 + losses_2v2 >= 3
  )
  UPDATE public.profiles p
  SET best_rank = least(coalesce(p.best_rank, 999), ranked.position)
  FROM ranked WHERE ranked.id = p.id;
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
  UPDATE public.profiles p
  SET elo_1v1 = 1000, elo_2v2 = 1000, elo_total = 1000,
      league_points = 0, wins_1v1 = 0, losses_1v1 = 0,
      wins_2v2 = 0, losses_2v2 = 0, current_streak = 0,
      xp = 0, level = 1, xp_next_level = 150,
      elo_history = '[]'::jsonb, best_rank = 999,
      badges = (
        SELECT coalesce(jsonb_agg(value ORDER BY ordinality), '[]'::jsonb)
        FROM jsonb_array_elements_text(coalesce(p.badges, '[]'::jsonb)) WITH ORDINALITY
        WHERE value NOT IN (
          'stammgast_1', 'siegertyp_1', 'revanche', 'eingespielt_1',
          'streak_master', 'clean_sheet', 'legend_1500'
        )
      ),
      updated_at = NOW();
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

REVOKE ALL ON FUNCTION public.apply_match_core_stats(public.matches) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_match_stats(public.matches) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rebuild_match_stats() FROM PUBLIC, anon, authenticated;

SELECT public.rebuild_match_stats();

COMMIT;
