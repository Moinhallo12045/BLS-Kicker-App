\set ON_ERROR_STOP on

-- Run after secure_upgrade.sql. Recreate the originally deployed bare DELETEs.
DO $$
DECLARE definition TEXT;
BEGIN
  definition := pg_get_functiondef('public.rebuild_match_stats()'::regprocedure);
  definition := replace(definition,' WHERE player_id IS NOT NULL;',';');
  definition := replace(definition,' WHERE match_id IS NOT NULL;',';');
  EXECUTE definition;
END;
$$;
\ir ../migrations/20261103183000_fix_unconditional_stats_delete.sql
DO $$
BEGIN
  IF position('DELETE FROM public.scoring_losses;' IN
      pg_get_functiondef('public.rebuild_match_stats()'::regprocedure))=0 THEN
    RAISE EXCEPTION 'Fixture must reproduce the previous repair missing a bare DELETE';
  END IF;
END;
$$;
\if :{?test_safeupdate}
LOAD 'safeupdate';
DO $$
BEGIN
  BEGIN
    PERFORM public.rebuild_match_stats();
  EXCEPTION WHEN cardinality_violation THEN
    IF SQLERRM='DELETE requires a WHERE clause' THEN RETURN; END IF;
    RAISE;
  END;
  RAISE EXCEPTION 'Legacy replay did not reproduce the Supabase DELETE error';
END;
$$;
\endif
\ir ../migrations/20261103190000_repair_legacy_stats_deletes.sql

DO $$
DECLARE definition TEXT; target_table TEXT; key_column TEXT;
BEGIN
  definition := pg_get_functiondef('public.rebuild_match_stats()'::regprocedure);
  FOR target_table,key_column IN SELECT * FROM (VALUES
    ('scoring_losses','player_id'),('scoring_partner_wins','player_id'),('scoring_history','match_id')
  ) AS targets(table_name,column_name) LOOP
    IF position('DELETE FROM public.' || target_table || ' WHERE ' || key_column || ' IS NOT NULL;' IN definition)=0 THEN
      RAISE EXCEPTION 'Legacy DELETE not repaired: %',target_table;
    END IF;
  END LOOP;
  IF has_function_privilege('authenticated','public.rebuild_match_stats()','EXECUTE')
    OR has_function_privilege('anon','public.rebuild_match_stats()','EXECUTE')
    OR has_function_privilege('authenticated','public.refresh_tournament_badges()','EXECUTE')
    OR has_function_privilege('anon','public.refresh_tournament_badges()','EXECUTE') THEN
    RAISE EXCEPTION 'Repair exposed internal replay function';
  END IF;
END;
$$;

-- Also cover the intermediate WHERE TRUE form and repeat application.
DO $$
DECLARE definition TEXT;
BEGIN
  definition := pg_get_functiondef('public.rebuild_match_stats()'::regprocedure);
  definition := replace(definition,' WHERE player_id IS NOT NULL;',' WHERE TRUE;');
  definition := replace(definition,' WHERE match_id IS NOT NULL;',' WHERE TRUE;');
  EXECUTE definition;
END;
$$;
\ir ../migrations/20261103190000_repair_legacy_stats_deletes.sql
\ir ../migrations/20261103190000_repair_legacy_stats_deletes.sql

BEGIN;
SELECT set_config('app.server_operation','true',true);
UPDATE public.profiles SET role='owner' WHERE id='00000000-0000-0000-0000-000000000001';
INSERT INTO auth.users VALUES
  ('00000000-0000-0000-0000-000000000003'),('00000000-0000-0000-0000-000000000004');
INSERT INTO public.profiles(id,auth_user_id,name)
SELECT id,id,id::TEXT FROM auth.users WHERE id IN
  ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000004');
SELECT set_config('app.server_operation','',true);
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
SET LOCAL ROLE authenticated;
SELECT public.submit_match_result('2v2',
  ARRAY['00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003']::UUID[],
  ARRAY['00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000004']::UUID[],10,7);
RESET ROLE;
DO $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.scoring_losses)
    OR NOT EXISTS(SELECT 1 FROM public.scoring_partner_wins)
    OR NOT EXISTS(SELECT 1 FROM public.scoring_history) THEN
    RAISE EXCEPTION 'Annulment fixture must populate all three scoring tables';
  END IF;
END;
$$;
SET LOCAL ROLE authenticated;
SELECT public.dispute_match(id,'Incorrect score',10,9) FROM public.matches;
SELECT public.cancel_match(id) FROM public.matches ORDER BY created_at,id;
RESET ROLE;
DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM public.matches WHERE status<>'cancelled' OR result_applied)
    OR EXISTS(SELECT 1 FROM public.scoring_losses)
    OR EXISTS(SELECT 1 FROM public.scoring_partner_wins)
    OR EXISTS(SELECT 1 FROM public.scoring_history)
    OR EXISTS(SELECT 1 FROM public.profiles WHERE elo_total<>1000 OR xp<>0 OR badges ? 'turnier_champ'
      OR wins_1v1<>0 OR losses_1v1<>0 OR wins_2v2<>0 OR losses_2v2<>0 OR elo_history<>'[]'::JSONB) THEN
    RAISE EXCEPTION 'Admin annulment failed to clear cancelled match statistics';
  END IF;
END;
$$;
ROLLBACK;

BEGIN;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
SET LOCAL ROLE authenticated;
SELECT public.dispute_match(id,'Wrong winner',5,10) FROM public.matches;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
SET LOCAL ROLE authenticated;
SELECT public.accept_match_proposal(id) FROM public.matches;
RESET ROLE;
DO $$
BEGIN
  IF (SELECT wins_1v1 FROM public.profiles WHERE id='00000000-0000-0000-0000-000000000002')<>2
    OR (SELECT count(*) FROM public.scoring_history)<>4
    OR EXISTS(SELECT 1 FROM public.matches WHERE status<>'confirmed' OR score_a<>5 OR score_b<>10) THEN
    RAISE EXCEPTION 'Accepted score correction failed to rebuild statistics';
  END IF;
END;
$$;
ROLLBACK;
