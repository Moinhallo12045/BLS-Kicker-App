\set ON_ERROR_STOP on

SELECT public.test_assert(
  has_function_privilege('authenticated','public.delete_player(UUID)','EXECUTE')
  AND NOT has_function_privilege('anon','public.delete_player(UUID)','EXECUTE')
  AND NOT has_table_privilege('authenticated','public.profiles','DELETE'),
  'player deletion is RPC-only');

BEGIN;
SELECT set_config('app.server_operation','true',true);
INSERT INTO auth.users SELECT ('00000000-0000-0000-0000-'||lpad(n::TEXT,12,'0'))::UUID
FROM generate_series(21,25)n;
INSERT INTO public.profiles(id,auth_user_id,name,role) VALUES
  ('00000000-0000-0000-0000-000000000020','00000000-0000-0000-0000-000000000021','Deleting co-owner','co_owner'),
  ('00000000-0000-0000-0000-000000000022','00000000-0000-0000-0000-000000000022','Other co-owner','co_owner'),
  ('00000000-0000-0000-0000-000000000023','00000000-0000-0000-0000-000000000023','Co-owner target','player'),
  ('00000000-0000-0000-0000-000000000024','00000000-0000-0000-0000-000000000024','Owner target','player'),
  ('00000000-0000-0000-0000-000000000025','00000000-0000-0000-0000-000000000025','Protected owner','owner');
SELECT set_config('app.server_operation','',true);

SET LOCAL ROLE anon;
SELECT public.test_denied($q$SELECT public.delete_player('00000000-0000-0000-0000-000000000023')$q$);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000010',true);
SET LOCAL ROLE authenticated;
SELECT public.test_denied($q$SELECT public.delete_player('00000000-0000-0000-0000-000000000023')$q$);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000006',true);
SET LOCAL ROLE authenticated;
SELECT public.test_denied($q$SELECT public.delete_player('00000000-0000-0000-0000-000000000023')$q$);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000021',true);
SET LOCAL ROLE authenticated;
SELECT public.test_denied($q$SELECT public.delete_player('00000000-0000-0000-0000-000000000020')$q$);
SELECT public.test_denied($q$SELECT public.delete_player('00000000-0000-0000-0000-000000000025')$q$);
SELECT public.test_denied($q$SELECT public.delete_player('00000000-0000-0000-0000-000000000001')$q$);
SELECT public.test_denied($q$DELETE FROM public.profiles WHERE id='00000000-0000-0000-0000-000000000023'$q$);
SELECT public.delete_player('00000000-0000-0000-0000-000000000023');
SELECT public.delete_player('00000000-0000-0000-0000-000000000022');
RESET ROLE;
SELECT public.test_assert(
  NOT EXISTS(SELECT 1 FROM public.profiles WHERE id IN
    ('00000000-0000-0000-0000-000000000023','00000000-0000-0000-0000-000000000022'))
  AND EXISTS(SELECT 1 FROM public.profiles WHERE id='00000000-0000-0000-0000-000000000020')
  AND EXISTS(SELECT 1 FROM public.profiles WHERE id='00000000-0000-0000-0000-000000000025')
  AND EXISTS(SELECT 1 FROM auth.users WHERE id='00000000-0000-0000-0000-000000000023'),
  'co-owner deletion, own-profile protection, owner protection and auth retention');

SELECT set_config('app.server_operation','true',true);
UPDATE public.profiles SET role=NULL WHERE id='00000000-0000-0000-0000-000000000020';
SELECT set_config('app.server_operation','',true);
SET LOCAL ROLE authenticated;
SELECT public.test_denied($q$SELECT public.delete_player('00000000-0000-0000-0000-000000000024')$q$);
RESET ROLE;
SELECT set_config('app.server_operation','true',true);
UPDATE public.profiles SET role='co_owner',is_suspended=true WHERE id='00000000-0000-0000-0000-000000000020';
SELECT set_config('app.server_operation','',true);
SET LOCAL ROLE authenticated;
SELECT public.test_denied($q$SELECT public.delete_player('00000000-0000-0000-0000-000000000024')$q$);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000009',true);
SET LOCAL ROLE authenticated;
SELECT public.test_denied($q$SELECT public.delete_player('00000000-0000-0000-0000-000000000009')$q$);
SELECT public.test_denied($q$SELECT public.delete_player('00000000-0000-0000-0000-000000000025')$q$);
SELECT public.test_denied($q$SELECT public.delete_player('00000000-0000-0000-0000-000000000001')$q$);
SELECT public.test_denied($q$SELECT public.delete_player('00000000-0000-0000-0000-000000000010')$q$);
SELECT public.test_denied($q$SELECT public.delete_player(NULL)$q$);
SELECT public.delete_player('00000000-0000-0000-0000-000000000024');
RESET ROLE;
SELECT public.test_assert(NOT EXISTS(
  SELECT 1 FROM public.profiles WHERE id='00000000-0000-0000-0000-000000000024'),'owner deletion');
SELECT public.rebuild_match_stats();
ROLLBACK;
