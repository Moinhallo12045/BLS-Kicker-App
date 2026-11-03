BEGIN;

CREATE OR REPLACE FUNCTION public.scoring_badges(
  p public.profiles,p_match public.matches,p_won BOOLEAN,p_revenge BOOLEAN,p_pair_wins INT
)
RETURNS JSONB LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE earned TEXT[] := '{}'; played INT;
BEGIN
  played:=p.wins_1v1+p.losses_1v1+p.wins_2v2+p.losses_2v2;
  IF played>=10 THEN earned:=array_append(earned,'stammgast_1'); END IF;
  IF played>=25 THEN earned:=array_append(earned,'stammgast_2'); END IF;
  IF played>=50 THEN earned:=array_append(earned,'stammgast_3'); END IF;
  IF p.wins_1v1+p.wins_2v2>=5 THEN earned:=array_append(earned,'siegertyp_1'); END IF;
  IF p.current_streak>=5 THEN earned:=array_append(earned,'streak_master'); END IF;
  IF p.current_streak>=10 THEN earned:=array_append(earned,'streak_master_2'); END IF;
  IF p.current_streak>=15 THEN earned:=array_append(earned,'streak_master_3'); END IF;
  IF p.wins_1v1>=5 AND p.wins_2v2>=5 THEN earned:=array_append(earned,'allrounder_1'); END IF;
  IF p_won AND abs(p_match.score_a-p_match.score_b)=1 THEN earned:=array_append(earned,'knapper_sieg'); END IF;
  IF p_won AND greatest(p_match.score_a,p_match.score_b)=10 AND least(p_match.score_a,p_match.score_b)<=1 THEN
    earned:=array_append(earned,'clean_sheet');
  END IF;
  IF greatest(p.elo_1v1,p.elo_2v2,p.elo_total)>1500 THEN earned:=array_append(earned,'legend_1500'); END IF;
  IF p_won AND p_revenge THEN earned:=array_append(earned,'revanche'); END IF;
  IF p_won AND p_match.mode='2v2' AND p_pair_wins>=3 THEN earned:=array_append(earned,'eingespielt_1'); END IF;
  IF p_won AND p_match.mode='2v2' AND p_pair_wins>=10 THEN earned:=array_append(earned,'eingespielt_2'); END IF;
  IF p_won AND p_match.mode='2v2' AND p_pair_wins>=25 THEN earned:=array_append(earned,'eingespielt_3'); END IF;
  RETURN (SELECT coalesce(jsonb_agg(DISTINCT badge ORDER BY badge),'[]'::jsonb)
    FROM (SELECT jsonb_array_elements_text(p.badges) badge UNION ALL SELECT unnest(earned)) b);
END;
$$;

REVOKE ALL ON FUNCTION public.scoring_badges(public.profiles,public.matches,BOOLEAN,BOOLEAN,INT)
  FROM PUBLIC,anon,authenticated;

DO $$
DECLARE definition TEXT; old_badges TEXT; new_badges TEXT;
BEGIN
  definition:=pg_get_functiondef('public.rebuild_match_stats()'::regprocedure);
  old_badges:='''stammgast_1'',''siegertyp_1'',''revanche'',''eingespielt_1'',''streak_master'',''clean_sheet'',''legend_1500'',''turnier_champ''';
  new_badges:='''stammgast_1'',''stammgast_2'',''stammgast_3'',''siegertyp_1'',''revanche'',''eingespielt_1'',''eingespielt_2'',''eingespielt_3'',''streak_master'',''streak_master_2'',''streak_master_3'',''allrounder_1'',''knapper_sieg'',''clean_sheet'',''legend_1500'',''turnier_champ''';
  IF position(old_badges IN definition)=0 THEN
    RAISE EXCEPTION 'Cannot locate derived badge reset list in rebuild_match_stats()';
  END IF;
  definition:=replace(definition,old_badges,new_badges);
  EXECUTE definition;
END;
$$;

SELECT public.rebuild_match_stats();
COMMIT;
