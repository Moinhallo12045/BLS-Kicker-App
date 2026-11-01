ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS dispute_proposed_score_a INT,
  ADD COLUMN IF NOT EXISTS dispute_proposed_score_b INT,
  ADD COLUMN IF NOT EXISTS dispute_proposed_by UUID REFERENCES public.profiles(id);

CREATE OR REPLACE FUNCTION public.dispute_match(
  p_match_id UUID,
  p_reason TEXT,
  p_score_a INT DEFAULT NULL,
  p_score_b INT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_profile UUID;
BEGIN
  PERFORM set_config('app.server_operation', 'true', true);
  SELECT id INTO actor_profile
  FROM public.profiles
  WHERE auth_user_id = auth.uid() AND NOT is_suspended;
  IF actor_profile IS NULL OR length(trim(coalesce(p_reason, ''))) = 0 THEN
    RAISE EXCEPTION 'A player and dispute reason are required';
  END IF;
  IF (p_score_a IS NULL) <> (p_score_b IS NULL)
     OR (p_score_a IS NOT NULL AND (p_score_a < 0 OR p_score_b < 0 OR p_score_a = p_score_b)) THEN
    RAISE EXCEPTION 'Invalid proposed score';
  END IF;
  UPDATE public.matches
  SET status = 'disputed',
      disputed_by = actor_profile,
      dispute_reason = trim(p_reason),
      dispute_proposed_score_a = p_score_a,
      dispute_proposed_score_b = p_score_b,
      dispute_proposed_by = actor_profile,
      updated_at = NOW()
  WHERE id = p_match_id
    AND actor_profile = ANY(team_a || team_b)
    AND status <> 'cancelled';
END;
$$;

GRANT EXECUTE ON FUNCTION public.dispute_match(UUID, TEXT, INT, INT) TO authenticated;
