\set ON_ERROR_STOP on
\ir match_stats_bootstrap.sql
\ir ../migrations/20261101210000_rebuild_match_stats_on_removal.sql
\ir ../migrations/20261101213500_rebuild_match_achievements.sql
\ir ../migrations/20261101220000_secure_client_contracts.sql
\ir ../migrations/20261101221000_fixed_pair_tournaments.sql
\ir ../migrations/20261101222000_linear_scoring_replay.sql
\ir ../migrations/20261101223000_in_memory_replay.sql
\ir ../migrations/20261101224000_application_rpc_aliases.sql
\ir ../migrations/20261101225000_logic_consistency.sql

CREATE FUNCTION public.test_assert(ok BOOLEAN,message TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'Assertion failed: %',message; END IF; END;
$$;
CREATE FUNCTION public.test_denied(statement TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE denied BOOLEAN := false;
BEGIN
  BEGIN EXECUTE statement; EXCEPTION WHEN OTHERS THEN denied:=true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Attack unexpectedly succeeded: %',statement; END IF;
END;
$$;
SELECT set_config('app.server_operation','true',false);
INSERT INTO auth.users SELECT ('00000000-0000-0000-0000-'||lpad(n::TEXT,12,'0'))::UUID FROM generate_series(1,10) n;
INSERT INTO public.profiles(id,auth_user_id,name,email,role)
SELECT id,id,'Player '||id,'private-'||id||'@example.com',
  CASE WHEN right(id::TEXT,1)='9' THEN 'owner' WHEN right(id::TEXT,1)='0' THEN 'admin' ELSE 'player' END
FROM auth.users;
SELECT set_config('app.server_operation','',false);
SELECT public.test_assert(NOT has_column_privilege('authenticated','public.profiles','email','SELECT')
  AND NOT has_column_privilege('anon','public.profiles','auth_user_id','SELECT')
  AND has_column_privilege('authenticated','public.profiles','name','SELECT'),'private read grants');
SELECT public.test_assert(NOT has_table_privilege('authenticated','public.profiles','INSERT')
  AND NOT has_table_privilege('authenticated','public.matches','UPDATE')
  AND NOT has_table_privilege('authenticated','public.tournaments','DELETE'),'RPC-only writes');

BEGIN;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000010',true);
SET LOCAL ROLE authenticated;
SELECT public.test_denied($q$UPDATE public.profiles SET auth_user_id='00000000-0000-0000-0000-000000000010' WHERE role='owner'$q$);
SELECT public.test_denied($q$UPDATE public.profiles SET xp=99999 WHERE name LIKE 'Player%'$q$);
SELECT public.test_denied($q$UPDATE public.profiles SET is_suspended=true WHERE role='player'$q$);
SELECT public.test_denied($q$UPDATE public.profiles SET role=NULL WHERE role='player'$q$);
SELECT public.test_denied($q$SELECT email FROM public.profiles$q$);
SELECT public.test_assert((public.get_my_profile()).email LIKE 'private-%','own full profile');
SELECT public.set_player_suspension('00000000-0000-0000-0000-000000000008',true);
SELECT public.test_denied($q$SELECT public.set_player_suspension('00000000-0000-0000-0000-000000000009',true)$q$);
SELECT public.create_invite_code(' mobile-2026 ',5);
SELECT public.test_denied($q$SELECT public.submit_match_result('1v1',
 ARRAY['00000000-0000-0000-0000-000000000010']::UUID[],
 ARRAY['00000000-0000-0000-0000-000000000001']::UUID[],11,5)$q$);
SELECT public.test_denied($q$SELECT public.create_invite_code('mobile-2026',5)$q$);
SELECT public.test_denied($q$SELECT public.create_invite_code(NULL,NULL)$q$);
RESET ROLE;
SELECT public.test_assert(current_setting('app.server_operation',true) IS DISTINCT FROM 'true','RPC restores bypass');
COMMIT;

BEGIN;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
SET LOCAL ROLE authenticated;
UPDATE public.profiles SET avatar='🏆' WHERE id='00000000-0000-0000-0000-000000000001';
SELECT public.submit_match_result('1v1',ARRAY['00000000-0000-0000-0000-000000000001']::UUID[],
  ARRAY['00000000-0000-0000-0000-000000000002']::UUID[],10,5);
SELECT public.cancel_match(id) FROM public.matches;
RESET ROLE;
SELECT public.test_assert(bool_and(status='confirmed' AND result_applied AND cancellation_requested_by IS NOT NULL),
  'one participant cannot claim mutual cancellation') FROM public.matches;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
SET LOCAL ROLE authenticated;
SELECT public.cancel_match(id) FROM public.matches;
RESET ROLE;
SELECT public.test_assert(bool_and(status='cancelled' AND NOT result_applied),'opponent cancellation') FROM public.matches;
SELECT public.test_assert(bool_and(xp=0 AND elo_total=1000),'cancel rebuild') FROM public.profiles;
COMMIT;

CREATE TABLE public.test_tournament_state(tid UUID,mid TEXT);
GRANT ALL ON public.test_tournament_state TO authenticated;
BEGIN;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000010',true);
SET LOCAL ROLE authenticated;
INSERT INTO public.test_tournament_state(tid)
SELECT (public.create_tournament('Doubles','Fixed pairs','ko','2v2',(
 SELECT jsonb_agg(jsonb_build_object('id','team-'||n,'playerIds',
   jsonb_build_array('00000000-0000-0000-0000-'||lpad((n*2-1)::TEXT,12,'0'),
     '00000000-0000-0000-0000-'||lpad((n*2)::TEXT,12,'0')))) FROM generate_series(1,2)n
))).id;
SELECT public.test_denied(format('SELECT public.score_tournament_match(%L,%L,11,4)',tid,t.matches->0->>'id'))
FROM public.test_tournament_state s JOIN public.tournaments t ON t.id=s.tid;
SELECT public.score_tournament_match(tid,(t.matches->0->>'id'),10,4)
FROM public.test_tournament_state s JOIN public.tournaments t ON t.id=s.tid;
SELECT public.score_tournament_match(tid,(t.matches->0->>'id'),10,4)
FROM public.test_tournament_state s JOIN public.tournaments t ON t.id=s.tid;
RESET ROLE;
SELECT public.test_assert(count(*)=1,'idempotent scoring creates one league match') FROM public.matches WHERE tournament_id IS NOT NULL;
SELECT public.test_assert(bool_and(wins_2v2=1 AND badges ? 'turnier_champ'),'both winning teammates get champion')
FROM public.profiles WHERE id IN ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002');
COMMIT;
SELECT public.test_assert(status='completed' AND winner_team_id='team-1'
  AND jsonb_array_length(teams)=2 AND cardinality(participants)=4,'tournament persists after commit')
FROM public.tournaments;

BEGIN;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
SET LOCAL ROLE authenticated;
SELECT public.test_denied(format('SELECT public.score_tournament_match(%L,%L,4,10)',tid,t.matches->0->>'id'))
FROM public.test_tournament_state s JOIN public.tournaments t ON t.id=s.tid;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000010',true);
SET LOCAL ROLE authenticated;
SELECT public.score_tournament_match(tid,t.matches->0->>'id',4,10)
FROM public.test_tournament_state s JOIN public.tournaments t ON t.id=s.tid;
RESET ROLE;
SELECT public.test_assert(bool_and(NOT badges ? 'turnier_champ' AND wins_2v2=0),'correction clears stale champs')
FROM public.profiles WHERE id IN ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002');
SET LOCAL ROLE authenticated;
SELECT public.remove_tournament(tid) FROM public.test_tournament_state;
RESET ROLE;
SELECT public.test_assert(NOT EXISTS(SELECT 1 FROM public.tournaments)
  AND NOT EXISTS(SELECT 1 FROM public.matches WHERE result_applied)
  AND NOT EXISTS(SELECT 1 FROM public.profiles WHERE badges ? 'turnier_champ'),'removal clears results and champion');
ROLLBACK;

BEGIN;
INSERT INTO auth.users VALUES ('00000000-0000-0000-0000-000000000011');
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000009',true);
SET LOCAL ROLE authenticated;
SELECT public.add_whitelist_entry('@registration.example');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000011',true);
SELECT set_config('request.jwt.claims','{"email":"not-approved@example.net"}',true);
SET LOCAL ROLE authenticated;
SELECT public.test_denied($q$SELECT public.create_player_profile('Registered','⚽',2026)$q$);
RESET ROLE;
SELECT set_config('request.jwt.claims','{"email":"approved@registration.example"}',true);
SET LOCAL ROLE authenticated;
SELECT public.create_player_profile('Registered',NULL,2026);
SELECT public.test_assert((public.get_my_profile()).role='player' AND (public.get_my_profile()).xp=0
  AND NOT (public.get_my_profile()).is_suspended,'whitelist registration fixed defaults');
SELECT public.test_denied($q$UPDATE public.profiles SET role='admin' WHERE name='Registered'$q$);
RESET ROLE;
ROLLBACK;
SELECT public.test_assert(status='completed' AND winner_team_id='team-1','transaction rollback restores tournament') FROM public.tournaments;

BEGIN;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000008',true);
SET LOCAL ROLE authenticated;
SELECT public.test_denied($q$SELECT public.submit_match_result('1v1',
 ARRAY['00000000-0000-0000-0000-000000000008']::UUID[],
 ARRAY['00000000-0000-0000-0000-000000000001']::UUID[],10,5)$q$);
RESET ROLE;
ROLLBACK;
