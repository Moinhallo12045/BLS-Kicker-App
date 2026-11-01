CREATE OR REPLACE FUNCTION public.create_player_profile(
  p_name TEXT,
  p_avatar TEXT,
  p_year_joined INT
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_email TEXT := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  created_profile public.profiles;
BEGIN
  IF auth.uid() IS NULL OR actor_email = '' THEN
    RAISE EXCEPTION 'Authenticated email is required';
  END IF;

  IF p_name IS NULL OR length(trim(p_name)) = 0 OR length(trim(p_name)) > 80 THEN
    RAISE EXCEPTION 'Invalid player name';
  END IF;

  IF p_year_joined IS NULL
     OR p_year_joined < 2000
     OR p_year_joined > EXTRACT(YEAR FROM CURRENT_DATE)::INT THEN
    RAISE EXCEPTION 'Invalid university year';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.whitelist
    WHERE lower(pattern) = actor_email
       OR (left(pattern, 1) = '@' AND actor_email LIKE '%' || lower(pattern))
  ) THEN
    RAISE EXCEPTION 'Email is not whitelisted';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE lower(email) = actor_email
       OR lower(name) = lower(trim(p_name))
  ) THEN
    RAISE EXCEPTION 'Player name or email is already in use';
  END IF;

  INSERT INTO public.profiles (
    id,
    auth_user_id,
    name,
    avatar,
    email,
    year_joined,
    role
  )
  VALUES (
    auth.uid(),
    auth.uid(),
    trim(p_name),
    coalesce(nullif(trim(p_avatar), ''), '⚽'),
    actor_email,
    p_year_joined,
    'player'
  )
  RETURNING * INTO created_profile;

  RETURN created_profile;
END;
$$;

REVOKE ALL ON FUNCTION public.create_player_profile(TEXT, TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_player_profile(TEXT, TEXT, INT) TO authenticated;
