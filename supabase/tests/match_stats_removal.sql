\set ON_ERROR_STOP on

-- Run after match_stats_bootstrap.sql, before applying the new migration.
INSERT INTO auth.users (id)
SELECT ('00000000-0000-0000-0000-00000000000' || n)::UUID FROM generate_series(1, 5) n;
INSERT INTO public.profiles (id, auth_user_id, name, role, badges)
SELECT id, id, 'Test ' || id, CASE WHEN right(id::TEXT, 1) = '5' THEN 'admin' ELSE 'player' END,
       '["retained"]'::jsonb
FROM auth.users;
SELECT set_config('app.server_operation', 'true', false);
UPDATE public.profiles
SET elo_1v1 = 300, elo_2v2 = 200, elo_total = 250, league_points = 999,
    wins_1v1 = 99, xp = 999, level = 20, current_streak = 99;
INSERT INTO public.matches
  (id, mode, team_a, team_b, score_a, score_b, status, created_at, elo_change_a, result_applied)
VALUES
  ('10000000-0000-0000-0000-000000000001', '1v1',
   ARRAY['00000000-0000-0000-0000-000000000001']::UUID[],
   ARRAY['00000000-0000-0000-0000-000000000002']::UUID[],
   10, 5, 'confirmed', '2026-10-01 12:00:00+00', 0, FALSE),
  ('10000000-0000-0000-0000-000000000002', '1v1',
   ARRAY['00000000-0000-0000-0000-000000000001']::UUID[],
   ARRAY['00000000-0000-0000-0000-000000000003']::UUID[],
   10, 5, 'disputed', '2026-10-02 12:00:00+00', 16, FALSE),
  ('10000000-0000-0000-0000-000000000003', '1v1',
   ARRAY['00000000-0000-0000-0000-000000000001']::UUID[],
   ARRAY['00000000-0000-0000-0000-000000000002']::UUID[],
   10, 5, 'cancelled', '2026-10-03 12:00:00+00', 16, TRUE),
  ('10000000-0000-0000-0000-000000000004', '1v1',
   ARRAY['00000000-0000-0000-0000-000000000001']::UUID[],
   ARRAY['00000000-0000-0000-0000-000000000002']::UUID[],
   10, 5, 'pending', '2026-10-04 12:00:00+00', 0, FALSE);
SELECT set_config('app.server_operation', '', false);

\ir ../migrations/20261101210000_rebuild_match_stats_on_removal.sql

CREATE FUNCTION public.test_assert(ok BOOLEAN, message TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  IF ok IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'Assertion failed: %', message; END IF;
END;
$$;

SELECT public.test_assert(
  elo_1v1 = 1031 AND elo_2v2 = 1000 AND elo_total = 1015
  AND league_points = 6 AND wins_1v1 = 2 AND losses_1v1 = 0
  AND xp = 0 AND level = 2 AND xp_next_level = 150 AND current_streak = 2
  AND elo_history = '[{"date":"2026-10-01","elo":1008},{"date":"2026-10-02","elo":1015}]'::jsonb,
  'migration rebuilds legacy results, XP and historical dates')
FROM public.profiles WHERE right(id::TEXT, 1) = '1';
SELECT public.test_assert(
  elo_1v1 = 1000 AND elo_2v2 = 1000 AND elo_total = 1000
  AND league_points = 0 AND wins_1v1 = 0 AND losses_1v1 = 0
  AND xp = 0 AND level = 1 AND xp_next_level = 150 AND current_streak = 0
  AND elo_history = '[]'::jsonb AND role = 'admin' AND badges = '["retained"]'::jsonb,
  'idle profiles reset without changing roles or badges')
FROM public.profiles WHERE right(id::TEXT, 1) = '5';
SELECT public.test_assert(NOT result_applied AND elo_change_a = 0 AND elo_change_b = 0,
  'cancelled legacy results cleared')
FROM public.matches WHERE right(id::TEXT, 1) = '3';
SELECT public.test_assert(
  NOT has_function_privilege('authenticated', 'public.rebuild_match_stats()', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.cancel_match(uuid)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.apply_match_stats(public.matches)', 'EXECUTE'),
  'internal helpers are not API callable');

BEGIN;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000004', true);
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  BEGIN
    PERFORM public.cancel_match('10000000-0000-0000-0000-000000000001');
    RAISE EXCEPTION 'Unrelated player was allowed to cancel';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Only match participants or admins can cancel this match' THEN RAISE; END IF;
  END;
END;
$$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000099', true);
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  BEGIN
    PERFORM public.cancel_match('10000000-0000-0000-0000-000000000001');
    RAISE EXCEPTION 'Unlinked player was allowed to cancel';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Only match participants or admins can cancel this match' THEN RAISE; END IF;
  END;
END;
$$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
SET LOCAL ROLE authenticated;
SELECT public.cancel_match('10000000-0000-0000-0000-000000000001');
SELECT public.cancel_match('10000000-0000-0000-0000-000000000001');
DO $$
BEGIN
  BEGIN
    UPDATE public.profiles SET xp = 999 WHERE id = auth.uid();
    RAISE EXCEPTION 'Server-operation flag leaked';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Profile statistics are server-managed' THEN RAISE; END IF;
  END;
END;
$$;
RESET ROLE;
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  invalid_result RECORD;
BEGIN
  FOR invalid_result IN
    SELECT * FROM (VALUES
      ('1v1', ARRAY['00000000-0000-0000-0000-000000000001']::UUID[],
       ARRAY['00000000-0000-0000-0000-000000000099']::UUID[], 10, 0),
      ('2v2', ARRAY['00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001']::UUID[],
       ARRAY['00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003']::UUID[], 10, 0),
      ('1v1', ARRAY['00000000-0000-0000-0000-000000000001']::UUID[],
       ARRAY['00000000-0000-0000-0000-000000000002']::UUID[], 5, 5),
      ('1v1', ARRAY['00000000-0000-0000-0000-000000000001']::UUID[],
       ARRAY['00000000-0000-0000-0000-000000000002']::UUID[], -1, 5),
      ('1v1', NULL::UUID[], ARRAY['00000000-0000-0000-0000-000000000002']::UUID[], 10, 0)
    ) AS cases(mode, team_a, team_b, score_a, score_b)
  LOOP
    BEGIN
      PERFORM public.submit_match_result(invalid_result.mode, invalid_result.team_a,
        invalid_result.team_b, invalid_result.score_a, invalid_result.score_b);
      RAISE EXCEPTION 'Invalid submission was accepted';
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM NOT LIKE 'Invalid scored match:%' AND SQLERRM <> 'Invalid match result' THEN RAISE; END IF;
    END;
  END LOOP;
END;
$$;
RESET ROLE;
SELECT public.test_assert(
  elo_1v1 = 1016 AND elo_2v2 = 1000 AND elo_total = 1008
  AND wins_1v1 = 1 AND losses_1v1 = 0 AND league_points = 3
  AND xp = 75 AND level = 1 AND xp_next_level = 150 AND current_streak = 1
  AND elo_history = '[{"date":"2026-10-02","elo":1008}]'::jsonb,
  'cancellation removes XP and recalculates subsequent ELO')
FROM public.profiles WHERE right(id::TEXT, 1) = '1';
SELECT public.test_assert(elo_1v1 = 1000 AND losses_1v1 = 0 AND xp = 0 AND elo_history = '[]'::jsonb,
  'former opponent returns to baseline')
FROM public.profiles WHERE right(id::TEXT, 1) = '2';
SELECT public.test_assert(elo_change_a = 16 AND elo_change_b = -16 AND result_applied,
  'remaining disputed game stays scored with corrected deltas')
FROM public.matches WHERE right(id::TEXT, 1) = '2';

SET LOCAL ROLE authenticated;
SELECT public.submit_match_result('2v2',
  ARRAY['00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000004']::UUID[],
  ARRAY['00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003']::UUID[],
  10, 0);
RESET ROLE;
SELECT public.test_assert(elo_1v1 = 1016 AND elo_2v2 = 1016 AND elo_total = 1016
  AND wins_2v2 = 1 AND xp = 0 AND level = 2 AND current_streak = 2,
  'new submission uses unchanged scoring rules after rebuild')
FROM public.profiles WHERE right(id::TEXT, 1) = '1';

-- A score correction must replace a win with a loss and break the streak.
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000005', true);
SET LOCAL ROLE authenticated;
UPDATE public.matches SET score_a = 0, score_b = 10 WHERE mode = '2v2';
RESET ROLE;
SELECT public.test_assert(wins_2v2 = 0 AND losses_2v2 = 1 AND current_streak = 0
  AND xp = 100 AND level = 1 AND elo_2v2 = 984,
  'score correction rebuilds wins, losses, streak and XP')
FROM public.profiles WHERE right(id::TEXT, 1) = '1';

-- The schema has no DELETE policy: privileged maintenance deletes are supported.
DELETE FROM public.matches WHERE result_applied;
SELECT public.test_assert(
  bool_and(elo_1v1 = 1000 AND elo_2v2 = 1000 AND elo_total = 1000
    AND wins_1v1 = 0 AND losses_1v1 = 0 AND wins_2v2 = 0 AND losses_2v2 = 0
    AND league_points = 0 AND xp = 0 AND level = 1 AND xp_next_level = 150
    AND current_streak = 0 AND elo_history = '[]'::jsonb),
  'bulk deletion of all scored games resets every statistic')
FROM public.profiles;
DELETE FROM public.matches WHERE TRUE;
DELETE FROM public.matches WHERE FALSE;
SELECT public.rebuild_match_stats();
SELECT public.test_assert(bool_and(xp = 0 AND level = 1 AND elo_total = 1000),
  'empty rebuild and repeated deletes are idempotent') FROM public.profiles;

-- Equal timestamps use UUID order and the level cap is replayed.
SELECT set_config('app.server_operation', 'true', true);
INSERT INTO public.matches (id, mode, team_a, team_b, score_a, score_b, status, result_applied, created_at)
SELECT ('20000000-0000-0000-0000-' || lpad(n::TEXT, 12, '0'))::UUID, '1v1',
  ARRAY['00000000-0000-0000-0000-000000000001']::UUID[],
  ARRAY['00000000-0000-0000-0000-000000000002']::UUID[],
  10, 0, 'confirmed', TRUE, '2026-10-01 12:00:00+00'::TIMESTAMPTZ
FROM generate_series(1, 1200) n;
SELECT public.rebuild_match_stats();
SELECT public.test_assert(level = 50 AND xp_next_level = 1350 AND xp > xp_next_level
  AND current_streak = 1200 AND wins_1v1 = 1200 AND league_points = 3600
  AND jsonb_array_length(elo_history) = 1200,
  'level cap retains overflow XP and full ordered history')
FROM public.profiles WHERE right(id::TEXT, 1) = '1';
CREATE TEMP TABLE before_replay AS
SELECT id, to_jsonb(p) - 'updated_at' AS stats FROM public.profiles p;
SELECT public.rebuild_match_stats();
SELECT public.test_assert(bool_and(b.stats = to_jsonb(p) - 'updated_at'),
  'repeated replay is deterministic') FROM public.profiles p JOIN before_replay b USING (id);
DELETE FROM public.matches WHERE right(id::TEXT, 4)::INT > 2;
SELECT public.test_assert(level = 2 AND xp = 0 AND xp_next_level = 150
  AND current_streak = 2 AND wins_1v1 = 2 AND elo_1v1 = 1031,
  'bulk removal across level cap restores lower level and XP exactly')
FROM public.profiles WHERE right(id::TEXT, 1) = '1';
DELETE FROM public.matches WHERE TRUE;
UPDATE public.profiles SET elo_1v1 = 100;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
SELECT public.submit_match_result('1v1',
  ARRAY['00000000-0000-0000-0000-000000000001']::UUID[],
  ARRAY['00000000-0000-0000-0000-000000000002']::UUID[], 10, 0);
SELECT public.test_assert(elo_1v1 = 100, 'submission preserves ELO floor')
FROM public.profiles WHERE right(id::TEXT, 1) = '2';
DELETE FROM public.matches WHERE TRUE;
SELECT public.test_assert(bool_and(elo_1v1 = 1000), 'deletion replaces clamped ratings with baseline')
FROM public.profiles;
INSERT INTO public.matches (id, mode, team_a, team_b, score_a, score_b, status, result_applied, created_at)
SELECT ('30000000-0000-0000-0000-' || lpad(n::TEXT, 12, '0'))::UUID, '1v1',
  ARRAY['00000000-0000-0000-0000-000000000001']::UUID[],
  ARRAY['00000000-0000-0000-0000-000000000002']::UUID[],
  CASE WHEN n = 1 THEN 10 ELSE 0 END, CASE WHEN n = 1 THEN 0 ELSE 10 END,
  'confirmed', TRUE, '2026-10-01 12:00:00+00'::TIMESTAMPTZ
FROM generate_series(2, 1, -1) n;
SELECT public.rebuild_match_stats();
SELECT public.test_assert(elo_1v1 = 999 AND current_streak = 0 AND wins_1v1 = 1
  AND losses_1v1 = 1 AND xp = 100,
  'UUID tie-break orders equal timestamps independently of insertion order')
FROM public.profiles WHERE right(id::TEXT, 1) = '1';
UPDATE public.profiles SET is_suspended = TRUE WHERE right(id::TEXT, 1) = '2';
SELECT set_config('app.server_operation', '', true);
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  BEGIN
    PERFORM public.submit_match_result('1v1',
      ARRAY['00000000-0000-0000-0000-000000000001']::UUID[],
      ARRAY['00000000-0000-0000-0000-000000000002']::UUID[], 10, 0);
    RAISE EXCEPTION 'Suspended participant was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Invalid match result' THEN RAISE; END IF;
  END;
END;
$$;
RESET ROLE;
ROLLBACK;

SELECT 'All match statistics regression checks passed' AS result;
