ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT FALSE;

CREATE OR REPLACE FUNCTION public.set_player_suspension(
  p_player_id UUID,
  p_suspended BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_player_id AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Suspension is not permitted';
  END IF;

  UPDATE public.profiles
  SET is_suspended = p_suspended, updated_at = NOW()
  WHERE id = p_player_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_player_suspension(UUID, BOOLEAN) TO authenticated;
