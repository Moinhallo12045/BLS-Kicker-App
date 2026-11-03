BEGIN;
SELECT pg_advisory_xact_lock(20261101,210000);

-- The original deployed function used bare DELETEs, which the previous
-- migration's exact WHERE TRUE replacements did not match.
DO $$
DECLARE
  definition TEXT;
  target_table TEXT;
  key_column TEXT;
BEGIN
  definition := pg_get_functiondef('public.rebuild_match_stats()'::regprocedure);
  FOR target_table, key_column IN
    SELECT * FROM (VALUES
      ('scoring_losses','player_id'),
      ('scoring_partner_wins','player_id'),
      ('scoring_history','match_id')
    ) AS targets(table_name,column_name)
  LOOP
    definition := regexp_replace(
      definition,
      'DELETE\s+FROM\s+public\.' || target_table || '\s*(WHERE\s+TRUE\s*)?;',
      'DELETE FROM public.' || target_table || ' WHERE ' || key_column || ' IS NOT NULL;',
      'gi'
    );
    IF position('DELETE FROM public.' || target_table || ' WHERE ' || key_column || ' IS NOT NULL;' IN definition)=0 THEN
      RAISE EXCEPTION 'Cannot repair statistics replay DELETE for %',target_table;
    END IF;
  END LOOP;
  EXECUTE definition;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_tournament_badges()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE prior TEXT := current_setting('app.server_operation',true);
BEGIN
  PERFORM set_config('app.server_operation','true',true);
  UPDATE public.profiles p SET badges=(
    SELECT coalesce(jsonb_agg(DISTINCT badge ORDER BY badge),'[]'::jsonb) FROM (
      SELECT value badge FROM jsonb_array_elements_text(p.badges) WHERE value<>'turnier_champ'
      UNION ALL SELECT 'turnier_champ' WHERE EXISTS (
        SELECT 1 FROM public.tournaments t WHERE t.status='completed' AND (
          (t.winner_team_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM jsonb_array_elements(t.teams) team WHERE team->>'id'=t.winner_team_id
              AND team->'playerIds' @> to_jsonb(ARRAY[p.id])))
          OR (t.winner_team_id IS NULL AND t.winner_id=p.id))
      )
    ) earned
  ) WHERE p.id IS NOT NULL;
  PERFORM set_config('app.server_operation',coalesce(prior,''),true);
END;
$$;
REVOKE ALL ON FUNCTION public.refresh_tournament_badges() FROM PUBLIC,anon,authenticated;

COMMIT;
