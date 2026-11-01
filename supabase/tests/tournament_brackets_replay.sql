\set ON_ERROR_STOP on
-- Run after secure_tournaments.sql in the same disposable database.
BEGIN;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000010',true);
SET LOCAL ROLE authenticated;
SELECT public.set_player_suspension('00000000-0000-0000-0000-000000000008',false);
DELETE FROM public.test_tournament_state;
INSERT INTO public.test_tournament_state(tid)
SELECT (public.create_tournament('Four pairs','Mobile KO','ko','2v2',(
 SELECT jsonb_agg(jsonb_build_object('id','pair-'||n,'playerIds',
   jsonb_build_array('00000000-0000-0000-0000-'||lpad((n*2-1)::TEXT,12,'0'),
     '00000000-0000-0000-0000-'||lpad((n*2)::TEXT,12,'0')))) FROM generate_series(1,4)n
))).id;
SELECT public.test_denied(format('SELECT public.score_tournament_match(%L,%L,10,4)',tid,t.matches->2->>'id'))
FROM public.test_tournament_state s JOIN public.tournaments t ON t.id=s.tid;
SELECT public.score_tournament_match(tid,t.matches->0->>'id',10,4)
FROM public.test_tournament_state s JOIN public.tournaments t ON t.id=s.tid;
SELECT public.score_tournament_match(tid,t.matches->1->>'id',10,4)
FROM public.test_tournament_state s JOIN public.tournaments t ON t.id=s.tid;
SELECT public.score_tournament_match(tid,t.matches->2->>'id',10,4)
FROM public.test_tournament_state s JOIN public.tournaments t ON t.id=s.tid;
RESET ROLE;
SELECT public.test_assert(t.status='completed' AND t.winner_team_id='pair-1'
  AND (SELECT count(*) FROM public.matches WHERE tournament_id=t.id AND result_applied)=3,'multi-round fixed pairs')
FROM public.test_tournament_state s JOIN public.tournaments t ON t.id=s.tid;
SET LOCAL ROLE authenticated;
SELECT public.score_tournament_match(tid,t.matches->0->>'id',4,10)
FROM public.test_tournament_state s JOIN public.tournaments t ON t.id=s.tid;
RESET ROLE;
SELECT public.test_assert(t.status='running' AND t.winner_team_id IS NULL
  AND t.matches->2->>'teamAId'='pair-2' AND t.matches->2->>'teamBId'='pair-3'
  AND t.matches->2->>'status'='pending' AND t.matches->2->>'leagueMatchId' IS NULL
  AND (SELECT count(*) FROM public.matches WHERE tournament_id=t.id AND result_applied)=2,'correction invalidates downstream result')
FROM public.test_tournament_state s JOIN public.tournaments t ON t.id=s.tid;
SET LOCAL ROLE authenticated;
SELECT public.cancel_match((t.matches->1->>'leagueMatchId')::UUID)
FROM public.test_tournament_state s JOIN public.tournaments t ON t.id=s.tid;
RESET ROLE;
SELECT public.test_assert(t.matches->2->>'teamBId' IS NULL
  AND (SELECT count(*) FROM public.matches WHERE tournament_id=t.id AND result_applied)=1,'reset removes descendant participants')
FROM public.test_tournament_state s JOIN public.tournaments t ON t.id=s.tid;
SET LOCAL ROLE authenticated;
SELECT public.test_denied($q$SELECT public.create_tournament('bad','','ko','2v2',
 '[{"id":"same","playerIds":["00000000-0000-0000-0000-000000000001","00000000-0000-0000-0000-000000000002"]},
 {"id":"same","playerIds":["00000000-0000-0000-0000-000000000003","00000000-0000-0000-0000-000000000004"]}]')$q$);
SELECT public.test_denied($q$SELECT public.create_tournament('bad','','ko',NULL,'[]')$q$);
SELECT public.test_denied($q$SELECT public.create_tournament('bad','','ko','1v1',
 '[{"id":"a","playerIds":["00000000-0000-0000-0000-000000000001"]},
 {"id":"b","playerIds":["00000000-0000-0000-0000-000000000001"]}]')$q$);
SELECT public.test_denied($q$SELECT public.create_tournament('bad','','ko','1v1',
 '[{"id":"a","playerIds":["00000000-0000-0000-0000-000000000001"]},
 {"id":"b","playerIds":["00000000-0000-0000-0000-000000000002"]},
 {"id":"c","playerIds":["00000000-0000-0000-0000-000000000003"]}]')$q$);
DELETE FROM public.test_tournament_state;
INSERT INTO public.test_tournament_state(tid)
SELECT (public.create_tournament('Group','','groups','1v1',
 '[{"id":"a","playerIds":["00000000-0000-0000-0000-000000000001"]},
 {"id":"b","playerIds":["00000000-0000-0000-0000-000000000002"]},
 {"id":"c","playerIds":["00000000-0000-0000-0000-000000000003"]}]')).id;
SELECT public.score_tournament_match(tid,t.matches->0->>'id',10,4)
FROM public.test_tournament_state s JOIN public.tournaments t ON t.id=s.tid;
SELECT public.score_tournament_match(tid,t.matches->1->>'id',10,4)
FROM public.test_tournament_state s JOIN public.tournaments t ON t.id=s.tid;
SELECT public.score_tournament_match(tid,t.matches->2->>'id',10,4)
FROM public.test_tournament_state s JOIN public.tournaments t ON t.id=s.tid;
RESET ROLE;
SELECT public.test_assert(status='completed' AND winner_team_id='a' AND jsonb_array_length(matches)=3,
  'full group round-robin schedule and winner') FROM public.tournaments WHERE type='groups';
ROLLBACK;

BEGIN;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000009',true);
SET LOCAL ROLE authenticated;
SELECT public.set_player_role('00000000-0000-0000-0000-000000000007','co_owner');
SELECT public.test_denied($q$SELECT public.set_player_role('00000000-0000-0000-0000-000000000006','owner')$q$);
SELECT public.test_denied($q$SELECT public.set_player_role('00000000-0000-0000-0000-000000000009','player')$q$);
SELECT public.add_whitelist_entry(' @example.org ');
SELECT public.test_denied($q$SELECT public.add_whitelist_entry('@%.org')$q$);
SELECT public.remove_whitelist_entry(id) FROM public.whitelist WHERE pattern='@example.org';
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000007',true);
SET LOCAL ROLE authenticated;
SELECT public.set_player_role('00000000-0000-0000-0000-000000000006','organiser');
SELECT public.test_denied($q$SELECT public.set_player_role('00000000-0000-0000-0000-000000000007','admin')$q$);
SELECT public.test_denied($q$SELECT public.set_player_role('00000000-0000-0000-0000-000000000006','co_owner')$q$);
RESET ROLE;
SELECT public.test_assert(current_setting('app.server_operation',true) IS DISTINCT FROM 'true','role RPC restores bypass');
ROLLBACK;

BEGIN;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
SET LOCAL ROLE authenticated;
INSERT INTO public.test_tournament_state(mid)
SELECT (public.submit_match_result('1v1',ARRAY['00000000-0000-0000-0000-000000000001']::UUID[],
  ARRAY['00000000-0000-0000-0000-000000000002']::UUID[],10,5)).id::TEXT;
SELECT public.propose_dispute_resolution(mid::UUID,4,10,'score wrong') FROM public.test_tournament_state WHERE mid IS NOT NULL;
SELECT public.test_denied(format('SELECT public.accept_match_proposal(%L)',mid)) FROM public.test_tournament_state WHERE mid IS NOT NULL;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
SET LOCAL ROLE authenticated;
SELECT public.test_denied(format('SELECT public.accept_dispute_resolution(%L,4,10,%L)',mid,
  '00000000-0000-0000-0000-000000000003')) FROM public.test_tournament_state WHERE mid IS NOT NULL;
SELECT public.accept_dispute_resolution(mid::UUID,4,10,'00000000-0000-0000-0000-000000000001')
FROM public.test_tournament_state WHERE mid IS NOT NULL;
RESET ROLE;
SELECT public.test_assert(status='confirmed' AND score_a=4 AND score_b=10 AND dispute_proposed_by IS NULL,'opponent accepts proposed correction')
FROM public.matches WHERE id IN(SELECT mid::UUID FROM public.test_tournament_state WHERE mid IS NOT NULL);
SELECT public.test_assert(elo_total=round((elo_1v1+elo_2v2)/2.0),'rounded fractional total')
FROM public.profiles WHERE wins_1v1+losses_1v1+wins_2v2+losses_2v2>0;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
SET LOCAL ROLE authenticated;
SELECT public.dispute_match(mid::UUID,'admin review') FROM public.test_tournament_state WHERE mid IS NOT NULL;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000010',true);
SET LOCAL ROLE authenticated;
SELECT public.admin_resolve_dispute(mid::UUID,'confirm',NULL,NULL) FROM public.test_tournament_state WHERE mid IS NOT NULL;
RESET ROLE;
CREATE TABLE public.test_before_replay AS SELECT id,elo_1v1,elo_2v2,elo_total,league_points,
  wins_1v1,losses_1v1,wins_2v2,losses_2v2,current_streak,xp,level,xp_next_level,elo_history,badges,best_rank
FROM public.profiles;
SELECT public.rebuild_match_stats();
SELECT public.test_assert(NOT EXISTS(
 SELECT id,elo_1v1,elo_2v2,elo_total,league_points,wins_1v1,losses_1v1,wins_2v2,losses_2v2,
   current_streak,xp,level,xp_next_level,elo_history,badges,best_rank FROM public.profiles
 EXCEPT SELECT * FROM public.test_before_replay),'incremental and replay scoring, history, badges and rank parity');
ROLLBACK;

-- Replay benchmark uses fixed player count and increasing history size.
BEGIN;
SELECT set_config('app.server_operation','true',true);
DELETE FROM public.matches;
DELETE FROM public.tournaments;
INSERT INTO public.matches(mode,team_a,team_b,score_a,score_b,status,result_applied,created_at)
SELECT '2v2',ARRAY['00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002']::UUID[],
 ARRAY['00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000004']::UUID[],
 CASE WHEN n%2=0 THEN 10 ELSE 4 END,CASE WHEN n%2=0 THEN 4 ELSE 10 END,'confirmed',true,
 '2026-01-01'::TIMESTAMPTZ+n*interval '1 minute' FROM generate_series(1,1000)n;
\timing on
SELECT public.rebuild_match_stats();
\timing off
SELECT public.test_assert(bool_and(jsonb_array_length(elo_history)=1000 AND wins_2v2=500 AND losses_2v2=500
  AND badges @> '["eingespielt_1","revanche","stammgast_1","siegertyp_1"]'),'1k replay counts/history/achievements')
FROM public.profiles WHERE id=ANY(ARRAY['00000000-0000-0000-0000-000000000001',
 '00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003',
 '00000000-0000-0000-0000-000000000004']::UUID[]);
INSERT INTO public.matches(mode,team_a,team_b,score_a,score_b,status,result_applied,created_at)
SELECT '2v2',ARRAY['00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002']::UUID[],
 ARRAY['00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000004']::UUID[],
 CASE WHEN n%2=0 THEN 10 ELSE 4 END,CASE WHEN n%2=0 THEN 4 ELSE 10 END,'confirmed',true,
 '2026-01-01'::TIMESTAMPTZ+n*interval '1 minute' FROM generate_series(1001,2000)n;
\timing on
SELECT public.rebuild_match_stats();
\timing off
SELECT public.test_assert(bool_and(jsonb_array_length(elo_history)=2000 AND wins_2v2=1000 AND losses_2v2=1000
  AND elo_total=round((elo_1v1+elo_2v2)/2.0)),'2k replay counts and fractional total')
FROM public.profiles WHERE id=ANY(ARRAY['00000000-0000-0000-0000-000000000001',
 '00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003',
 '00000000-0000-0000-0000-000000000004']::UUID[]);
SELECT public.test_assert(level=50 AND xp=64450 AND xp_next_level=1350,'canonical XP progression and cap (1000 wins,1000 losses)')
FROM public.profiles WHERE id='00000000-0000-0000-0000-000000000001';
ROLLBACK;

BEGIN;
SELECT set_config('app.server_operation','true',true);
DELETE FROM public.matches;
DELETE FROM public.tournaments;
INSERT INTO public.matches(mode,team_a,team_b,score_a,score_b,status,result_applied,created_at)
SELECT '1v1',ARRAY['00000000-0000-0000-0000-000000000001']::UUID[],
  ARRAY['00000000-0000-0000-0000-000000000002']::UUID[],10,5,'confirmed',true,
  '2026-10-01 12:00:00+00'::TIMESTAMPTZ+(n-1)*interval '1 day' FROM generate_series(1,2)n;
SELECT public.rebuild_match_stats();
SELECT public.test_assert(elo_1v1=1031 AND elo_total=1016 AND xp=0 AND level=2 AND xp_next_level=150
  AND elo_history='[{"date":"2026-10-01","elo":1008},{"date":"2026-10-02","elo":1016}]'::jsonb,
  'legacy-shaped results keep canonical XP rules and correct odd fractional average')
FROM public.profiles WHERE id='00000000-0000-0000-0000-000000000001';
ROLLBACK;
