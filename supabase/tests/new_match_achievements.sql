\set ON_ERROR_STOP on

BEGIN;
SELECT set_config('app.server_operation','true',true);
DELETE FROM public.matches WHERE TRUE;
SELECT set_config('app.server_operation','',true);
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE n INT;
BEGIN
  FOR n IN 1..25 LOOP
    PERFORM public.submit_match_result('1v1',
      ARRAY['00000000-0000-0000-0000-000000000001']::UUID[],
      ARRAY['00000000-0000-0000-0000-000000000002']::UUID[],10,CASE WHEN n=1 THEN 9 ELSE 5 END);
  END LOOP;
  FOR n IN 1..25 LOOP
    PERFORM public.submit_match_result('2v2',
      ARRAY['00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003']::UUID[],
      ARRAY['00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000004']::UUID[],10,5);
  END LOOP;
END;
$$;
RESET ROLE;

SELECT public.test_assert(
  badges @> '["stammgast_1","stammgast_2","stammgast_3","siegertyp_1",
    "streak_master","streak_master_2","streak_master_3","allrounder_1","knapper_sieg"]'::JSONB,
  'played-game, win, streak, all-rounder and narrow-win badges awarded')
FROM public.profiles WHERE right(id::TEXT,1)='1';
SELECT public.test_assert(badges @> '["eingespielt_1","eingespielt_2","eingespielt_3"]'::JSONB,
  'three cumulative partner-win tiers awarded')
FROM public.profiles WHERE right(id::TEXT,1) IN ('1','3');

CREATE TEMP TABLE expanded_achievements_before_replay AS
SELECT id,to_jsonb(p) AS profile
FROM public.profiles p WHERE right(id::TEXT,1) IN ('1','2','3','4');
SELECT public.rebuild_match_stats();
SELECT public.test_assert(
  (SELECT jsonb_agg(to_jsonb(p) ORDER BY p.id) FROM public.profiles p
    WHERE right(p.id::TEXT,1) IN ('1','2','3','4'))
  IS NOT DISTINCT FROM
  (SELECT jsonb_agg(profile ORDER BY id) FROM expanded_achievements_before_replay),
  'achievement migration replay produces stable derived profiles');

SELECT set_config('app.server_operation','true',true);
UPDATE public.matches SET score_b=5 WHERE result_applied AND mode='1v1';
SELECT set_config('app.server_operation','',true);
SELECT public.test_assert(NOT badges ? 'knapper_sieg',
  'correcting all one-goal scores revokes the narrow-win badge')
FROM public.profiles WHERE right(id::TEXT,1)='1';

SELECT set_config('app.server_operation','true',true);
UPDATE public.matches SET status='cancelled',result_applied=false
WHERE result_applied AND mode='2v2';
SELECT set_config('app.server_operation','',true);
SELECT public.test_assert(
  NOT badges ? 'allrounder_1' AND NOT badges ? 'eingespielt_1'
    AND NOT badges ? 'eingespielt_2' AND NOT badges ? 'eingespielt_3'
    AND NOT badges ? 'stammgast_3' AND badges ? 'stammgast_2'
    AND badges ? 'streak_master_3',
  'cancelling doubles revokes pair/all-rounder/participation tiers while keeping supported streak')
FROM public.profiles WHERE right(id::TEXT,1)='1';
SELECT public.rebuild_match_stats();
SELECT public.test_assert(NOT badges ? 'knapper_sieg' AND NOT badges ? 'allrounder_1'
  AND badges ? 'stammgast_2','corrected achievements remain deterministic on repeated replay')
FROM public.profiles WHERE right(id::TEXT,1)='1';
ROLLBACK;

SELECT 'All expanded match achievement regression checks passed' AS result;
