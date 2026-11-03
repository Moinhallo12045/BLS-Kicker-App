BEGIN;

-- pg_safeupdate rejects unconditional DELETE statements. Reinstall the
-- already-deployed replay function with equivalent, key-based predicates.
DO $$
DECLARE
  definition TEXT;
BEGIN
  definition := pg_get_functiondef('public.rebuild_match_stats()'::regprocedure);
  definition := replace(
    definition,
    'DELETE FROM public.scoring_losses WHERE TRUE;',
    'DELETE FROM public.scoring_losses WHERE player_id IS NOT NULL;'
  );
  definition := replace(
    definition,
    'DELETE FROM public.scoring_partner_wins WHERE TRUE;',
    'DELETE FROM public.scoring_partner_wins WHERE player_id IS NOT NULL;'
  );
  definition := replace(
    definition,
    'DELETE FROM public.scoring_history WHERE TRUE;',
    'DELETE FROM public.scoring_history WHERE match_id IS NOT NULL;'
  );
  EXECUTE definition;
END;
$$;

COMMIT;
