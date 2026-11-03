\set ON_ERROR_STOP on
BEGIN;
SELECT set_config('app.server_operation','true',true);
INSERT INTO auth.users VALUES('00000000-0000-0000-0000-000000000021');
INSERT INTO public.profiles(id,auth_user_id,name,role) VALUES
  ('00000000-0000-0000-0000-000000000020','00000000-0000-0000-0000-000000000021','History co-owner','co_owner');
SELECT set_config('app.server_operation','',true);
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000009',true);
SET LOCAL ROLE authenticated;
SELECT public.submit_match_result('1v1',
  ARRAY['00000000-0000-0000-0000-000000000009']::UUID[],
  ARRAY['00000000-0000-0000-0000-000000000006']::UUID[],10,5);
RESET ROLE;
SELECT public.rebuild_match_stats();

CREATE TEMP TABLE history_before AS SELECT
  (SELECT jsonb_agg(to_jsonb(m) ORDER BY id) FROM public.matches m) games,
  (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.tournaments t) tournaments,
  (SELECT jsonb_agg(jsonb_build_object('id',id,'elo_1v1',elo_1v1,'elo_2v2',elo_2v2,
    'elo_total',elo_total,'wins_1v1',wins_1v1,'losses_1v1',losses_1v1,
    'wins_2v2',wins_2v2,'losses_2v2',losses_2v2,'xp',xp,'level',level,
    'badges',badges,'elo_history',elo_history) ORDER BY id) FROM public.profiles) stats;

SET LOCAL ROLE authenticated;
SELECT public.delete_player('00000000-0000-0000-0000-000000000006');
SELECT public.delete_player('00000000-0000-0000-0000-000000000006');
SELECT public.test_denied($q$SELECT public.delete_player('00000000-0000-0000-0000-000000000009')$q$);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000021',true);
SET LOCAL ROLE authenticated;
-- This player is linked to the completed doubles tournament.
SELECT public.delete_player('00000000-0000-0000-0000-000000000001');
SELECT public.test_denied($q$SELECT public.delete_player('00000000-0000-0000-0000-000000000009')$q$);
SELECT public.test_denied($q$SELECT public.delete_player('00000000-0000-0000-0000-000000000020')$q$);
SELECT public.test_denied($q$SELECT public.set_player_suspension('00000000-0000-0000-0000-000000000006',false)$q$);
SELECT public.test_denied($q$SELECT public.submit_match_result('1v1',
  ARRAY['00000000-0000-0000-0000-000000000020']::UUID[],
  ARRAY['00000000-0000-0000-0000-000000000006']::UUID[],10,5)$q$);
RESET ROLE;
SELECT public.test_assert(bool_and(is_deleted AND is_suspended AND auth_user_id IS NULL
  AND role='player' AND email IS NULL AND year_joined IS NULL AND name LIKE 'Gelöschter Spieler %'),
  'historical profiles are anonymized and inactive')
FROM public.profiles WHERE id IN
  ('00000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000001');
SELECT public.test_denied($q$UPDATE public.profiles SET is_deleted=false
  WHERE id='00000000-0000-0000-0000-000000000006'$q$);
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000006',true);
SET LOCAL ROLE authenticated;
SELECT public.test_assert((public.get_my_profile()).id IS NULL,'deleted auth no longer resolves to profile');
SELECT public.test_denied($q$SELECT public.delete_player('00000000-0000-0000-0000-000000000002')$q$);
RESET ROLE;
SELECT public.test_assert(
  (SELECT jsonb_agg(to_jsonb(m) ORDER BY id) FROM public.matches m) IS NOT DISTINCT FROM games
  AND (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.tournaments t) IS NOT DISTINCT FROM tournaments,
  'deletion preserves every match and tournament') FROM history_before;
SELECT public.rebuild_match_stats();
SELECT public.test_assert(
  (SELECT jsonb_agg(jsonb_build_object('id',id,'elo_1v1',elo_1v1,'elo_2v2',elo_2v2,
    'elo_total',elo_total,'wins_1v1',wins_1v1,'losses_1v1',losses_1v1,
    'wins_2v2',wins_2v2,'losses_2v2',losses_2v2,'xp',xp,'level',level,
    'badges',badges,'elo_history',elo_history) ORDER BY id) FROM public.profiles) IS NOT DISTINCT FROM stats,
  'replay after deletion preserves player results and badges') FROM history_before;
ROLLBACK;
