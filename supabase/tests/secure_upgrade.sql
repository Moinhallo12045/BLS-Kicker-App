\set ON_ERROR_STOP on
-- Standalone populated upgrade regression for a disposable empty database.
\ir match_stats_bootstrap.sql
\ir ../migrations/20261101210000_rebuild_match_stats_on_removal.sql
\ir ../migrations/20261101213500_rebuild_match_achievements.sql
SELECT set_config('app.server_operation','true',false);
INSERT INTO auth.users VALUES('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');
INSERT INTO public.profiles(id,auth_user_id,name,badges) SELECT id,id,id::TEXT,'["manual","turnier_champ"]' FROM auth.users;
INSERT INTO public.matches(mode,team_a,team_b,score_a,score_b,status,result_applied,created_at)
SELECT '1v1',ARRAY['00000000-0000-0000-0000-000000000001']::UUID[],
  ARRAY['00000000-0000-0000-0000-000000000002']::UUID[],10,5,'confirmed',true,
  '2026-10-01 12:00:00+00'::TIMESTAMPTZ+(n-1)*interval '1 day' FROM generate_series(1,2)n;
SELECT public.rebuild_match_stats();
SELECT set_config('app.server_operation','',false);
\ir ../migrations/20261101220000_secure_client_contracts.sql
\ir ../migrations/20261101221000_fixed_pair_tournaments.sql
\ir ../migrations/20261101222000_linear_scoring_replay.sql
\ir ../migrations/20261101223000_in_memory_replay.sql
\ir ../migrations/20261101224000_application_rpc_aliases.sql
\ir ../migrations/20261101225000_logic_consistency.sql
DO $$
DECLARE p public.profiles;
BEGIN
  SELECT * INTO p FROM public.profiles WHERE id='00000000-0000-0000-0000-000000000001';
  IF p.elo_1v1<>1031 OR p.elo_total<>1016 OR p.xp<>0 OR p.level<>2 OR p.xp_next_level<>150
    OR p.elo_history IS DISTINCT FROM '[{"date":"2026-10-01","elo":1008},{"date":"2026-10-02","elo":1016}]'::jsonb
    OR p.badges IS DISTINCT FROM '["manual"]'::jsonb THEN
    RAISE EXCEPTION 'Populated upgrade failed canonical scoring/privacy/badge regression: %',to_jsonb(p);
  END IF;
  IF has_column_privilege('authenticated','public.profiles','email','SELECT')
    OR has_function_privilege('anon','public.consume_invite_code(TEXT)','EXECUTE') THEN
    RAISE EXCEPTION 'Upgrade leaves private client grants';
  END IF;
END;
$$;
