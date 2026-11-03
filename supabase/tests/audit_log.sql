\set ON_ERROR_STOP on
BEGIN;
SELECT set_config('app.server_operation','true',true);
INSERT INTO auth.users VALUES('00000000-0000-0000-0000-000000000031');
INSERT INTO public.profiles(id,auth_user_id,name) VALUES
  ('00000000-0000-0000-0000-000000000031','00000000-0000-0000-0000-000000000031','Audit target');
SELECT set_config('app.server_operation','',true);
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000009',true);
SET LOCAL ROLE authenticated;
SELECT (public.submit_match_result('1v1',
  ARRAY['00000000-0000-0000-0000-000000000009']::UUID[],
  ARRAY['00000000-0000-0000-0000-000000000031']::UUID[],10,5)).id AS audit_match_id \gset
SELECT public.test_assert(count(*)=0,'initial submission is not a correction')
FROM public.audit_log WHERE target_id=:'audit_match_id';
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000031',true);
SET LOCAL ROLE authenticated;
SELECT public.dispute_match(:'audit_match_id','Wrong result',5,10);
SELECT public.test_assert(count(*)=0,'ordinary players cannot read admin audit entries') FROM public.audit_log;
SELECT public.test_denied($q$INSERT INTO public.audit_log(actor_name,action,target_id,before,after)
  VALUES('Fake','player_deleted','00000000-0000-0000-0000-000000000031','{}','{}')$q$);
SELECT public.test_denied($q$UPDATE public.audit_log SET actor_name='Fake' WHERE TRUE$q$);
SELECT public.test_denied($q$DELETE FROM public.audit_log WHERE TRUE$q$);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000009',true);
SET LOCAL ROLE authenticated;
SELECT public.accept_match_proposal(:'audit_match_id');
SELECT public.cancel_match(:'audit_match_id');
SELECT public.cancel_match(:'audit_match_id');
SELECT public.delete_player('00000000-0000-0000-0000-000000000031');
SELECT public.delete_player('00000000-0000-0000-0000-000000000031');
RESET ROLE;
SELECT public.test_assert(count(*)=2 AND bool_and(actor_id='00000000-0000-0000-0000-000000000009'),
  'exactly one correction and annulment, attributed to actor') FROM public.audit_log WHERE target_id=:'audit_match_id';
SELECT public.test_assert(before->>'score_a'='10' AND after->>'score_a'='5'
  AND before->>'score_b'='5' AND after->>'score_b'='10','correct old/new score snapshots')
FROM public.audit_log WHERE target_id=:'audit_match_id' AND action='score_corrected';
SELECT public.test_assert(count(*)=1 AND bool_and(before='{"is_deleted":false}'::jsonb AND after='{"is_deleted":true}'::jsonb),
  'one deletion without identifying target fields') FROM public.audit_log
WHERE target_id='00000000-0000-0000-0000-000000000031' AND action='player_deleted';
SELECT public.rebuild_match_stats();
SELECT public.test_assert(count(*)=2,'scoring replay does not create phantom corrections')
FROM public.audit_log WHERE target_id=:'audit_match_id';
SET LOCAL ROLE anon;
SELECT public.test_denied($q$SELECT * FROM public.audit_log$q$);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000010',true);
SET LOCAL ROLE authenticated;
SELECT public.test_assert(count(*)=2,'admin can read audit') FROM public.audit_log WHERE target_id=:'audit_match_id';
SELECT public.test_denied($q$SELECT public.record_audit_change()$q$);
RESET ROLE;
ROLLBACK;
