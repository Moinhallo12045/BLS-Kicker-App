\set ON_ERROR_STOP on

SELECT set_config('app.server_operation', 'true', false);
DELETE FROM public.matches WHERE TRUE;
UPDATE public.profiles
SET best_rank = 1,
    badges = '["stammgast_1","siegertyp_1","revanche","eingespielt_1","streak_master","clean_sheet","legend_1500","turnier_champ","manual"]'::jsonb;
SELECT set_config('app.server_operation', '', false);

\ir ../migrations/20261101213500_rebuild_match_achievements.sql

SELECT public.test_assert(bool_and(
  best_rank = 999 AND badges @> '["manual","turnier_champ"]'::jsonb AND jsonb_array_length(badges) = 2
), 'migration removes stale match achievements but preserves independent badges')
FROM public.profiles;
SELECT public.test_assert(
  NOT has_function_privilege('authenticated', 'public.apply_match_stats(public.matches)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.apply_match_core_stats(public.matches)', 'EXECUTE'),
  'achievement and core helpers are private');

BEGIN;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  FOR n IN 1..10 LOOP
    PERFORM public.submit_match_result('1v1',
      ARRAY['00000000-0000-0000-0000-000000000001']::UUID[],
      ARRAY['00000000-0000-0000-0000-000000000002']::UUID[], 10, 5);
  END LOOP;
END;
$$;
RESET ROLE;
SELECT public.test_assert(
  badges @> '["stammgast_1","siegertyp_1","streak_master"]'::jsonb
  AND NOT badges ? 'clean_sheet' AND best_rank = 1,
  'new games award match-count, win and streak badges and qualifying rank')
FROM public.profiles WHERE right(id::TEXT, 1) = '1';
SELECT public.test_assert(badges ? 'stammgast_1' AND best_rank = 2,
  'loser earns participation badge and qualifying rank')
FROM public.profiles WHERE right(id::TEXT, 1) = '2';
SET LOCAL ROLE authenticated;
SELECT public.submit_match_result('1v1',
  ARRAY['00000000-0000-0000-0000-000000000001']::UUID[],
  ARRAY['00000000-0000-0000-0000-000000000002']::UUID[], 5, 10);
RESET ROLE;
SELECT public.test_assert(badges ? 'revanche', 'win over previous opponent awards revenge')
FROM public.profiles WHERE right(id::TEXT, 1) = '2';
SELECT public.rebuild_match_stats();
SELECT public.test_assert(badges ? 'streak_master' AND current_streak = 0,
  'historically earned streak survives a later loss')
FROM public.profiles WHERE right(id::TEXT, 1) = '1';
DELETE FROM public.matches WHERE score_a > score_b;
SELECT public.test_assert(
  badges @> '["manual","turnier_champ"]'::jsonb AND jsonb_array_length(badges) = 2 AND best_rank = 999,
  'deleting qualifying wins removes count, win, streak and rank achievements')
FROM public.profiles WHERE right(id::TEXT, 1) = '1';
SELECT public.test_assert(NOT badges ? 'revanche' AND best_rank = 999,
  'deleting prerequisite losses removes revenge badge')
FROM public.profiles WHERE right(id::TEXT, 1) = '2';

SET LOCAL ROLE authenticated;
DO $$
BEGIN
  FOR n IN 1..3 LOOP
    PERFORM public.submit_match_result('2v2',
      ARRAY['00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000004']::UUID[],
      ARRAY['00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003']::UUID[], 10, 1);
  END LOOP;
END;
$$;
RESET ROLE;
SELECT public.test_assert(bool_and(badges @> '["eingespielt_1","clean_sheet"]'::jsonb),
  'three same-partner wins award partnership and clean-sheet badges')
FROM public.profiles WHERE right(id::TEXT, 1) IN ('1', '4');
SET LOCAL ROLE authenticated;
SELECT public.cancel_match((SELECT id FROM public.matches WHERE mode = '2v2' ORDER BY created_at, id LIMIT 1));
RESET ROLE;
SELECT public.test_assert(bool_and(NOT badges ? 'eingespielt_1' AND badges ? 'clean_sheet'),
  'cancelling third partner win revokes partnership but retains supported clean-sheet')
FROM public.profiles WHERE right(id::TEXT, 1) IN ('1', '4');
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000005', true);
SET LOCAL ROLE authenticated;
UPDATE public.matches SET score_b = 5 WHERE mode = '2v2' AND result_applied;
RESET ROLE;
SELECT public.test_assert(bool_and(NOT badges ? 'clean_sheet'),
  'correcting all clean-sheet scores removes clean-sheet achievements')
FROM public.profiles;

SELECT set_config('app.server_operation', 'true', true);
UPDATE public.profiles SET elo_1v1 = 1600 WHERE right(id::TEXT, 1) = '1';
SELECT set_config('app.server_operation', '', true);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
SET LOCAL ROLE authenticated;
SELECT public.submit_match_result('1v1',
  ARRAY['00000000-0000-0000-0000-000000000001']::UUID[],
  ARRAY['00000000-0000-0000-0000-000000000002']::UUID[], 10, 5);
RESET ROLE;
SELECT public.test_assert(badges ? 'legend_1500', 'rating over 1500 awards ELO badge')
FROM public.profiles WHERE right(id::TEXT, 1) = '1';
SELECT public.rebuild_match_stats();
SELECT public.test_assert(NOT badges ? 'legend_1500',
  'unsupported ELO milestone removed by replay')
FROM public.profiles WHERE right(id::TEXT, 1) = '1';
CREATE TEMP TABLE achievements_before_replay AS
SELECT id, badges, best_rank FROM public.profiles;
SELECT public.rebuild_match_stats();
SELECT public.test_assert(bool_and(p.badges = b.badges AND p.best_rank = b.best_rank),
  'achievement replay is deterministic')
FROM public.profiles p JOIN achievements_before_replay b USING (id);
DELETE FROM public.matches WHERE TRUE;
SELECT public.test_assert(bool_and(
  best_rank = 999 AND badges @> '["manual","turnier_champ"]'::jsonb AND jsonb_array_length(badges) = 2
), 'delete-all clears match achievements without altering independent badges')
FROM public.profiles;
ROLLBACK;

SELECT 'All match achievement regression checks passed' AS result;
