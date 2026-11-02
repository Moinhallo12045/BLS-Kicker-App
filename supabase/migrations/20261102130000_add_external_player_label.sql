BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN is_external BOOLEAN NOT NULL DEFAULT FALSE;

SELECT set_config('app.server_operation', 'true', true);

UPDATE public.profiles
SET is_external = lower(email) NOT LIKE '%@law-school.de',
    year_joined = CASE
      WHEN lower(email) NOT LIKE '%@law-school.de' THEN NULL
      ELSE year_joined
    END
WHERE email IS NOT NULL;

SELECT set_config('app.server_operation', '', true);

GRANT SELECT (is_external) ON public.profiles TO anon, authenticated;

DROP FUNCTION IF EXISTS public.create_player_profile(TEXT, TEXT, INT, BOOLEAN);

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

  IF (actor_email NOT LIKE '%@law-school.de' AND p_year_joined IS NOT NULL)
     OR (actor_email LIKE '%@law-school.de' AND (
       p_year_joined IS NULL
       OR p_year_joined < 2000
       OR p_year_joined > EXTRACT(YEAR FROM CURRENT_DATE)::INT
     )) THEN
    RAISE EXCEPTION 'Invalid player details';
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
    is_external,
    role
  )
  VALUES (
    auth.uid(),
    auth.uid(),
    trim(p_name),
    coalesce(nullif(trim(p_avatar), ''), '⚽'),
    actor_email,
    p_year_joined,
    actor_email NOT LIKE '%@law-school.de',
    'player'
  )
  RETURNING * INTO created_profile;

  RETURN created_profile;
END;
$$;

REVOKE ALL ON FUNCTION public.create_player_profile(TEXT, TEXT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_player_profile(TEXT, TEXT, INT) TO authenticated;

CREATE OR REPLACE FUNCTION public.prevent_profile_tampering()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE actor public.profiles;
BEGIN
  IF current_setting('app.server_operation', true) = 'true' THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.id IS DISTINCT FROM auth.uid() OR NEW.auth_user_id IS DISTINCT FROM auth.uid()
      OR NEW.role IS DISTINCT FROM 'player'
      OR lower(NEW.email) IS DISTINCT FROM lower(auth.jwt()->>'email')
      OR NEW.is_suspended IS DISTINCT FROM FALSE
      OR NEW.is_external IS DISTINCT FROM (lower(NEW.email) NOT LIKE '%@law-school.de')
      OR (NEW.is_external AND NEW.year_joined IS NOT NULL)
      OR (NOT NEW.is_external AND (
        NEW.year_joined IS NULL OR NEW.year_joined NOT BETWEEN 2000 AND extract(year FROM current_date)::INT
      ))
      OR ROW(NEW.level,NEW.xp,NEW.xp_next_level,NEW.elo_1v1,NEW.elo_2v2,NEW.elo_total,
        NEW.league_points,NEW.wins_1v1,NEW.losses_1v1,NEW.wins_2v2,NEW.losses_2v2,
        NEW.current_streak,NEW.best_rank,NEW.badges,NEW.elo_history)
        IS DISTINCT FROM ROW(1,0,150,1000,1000,1000,0,0,0,0,0,0,999,'[]'::jsonb,'[]'::jsonb)
      OR NOT EXISTS (SELECT 1 FROM public.whitelist WHERE lower(pattern)=lower(NEW.email)
        OR (left(pattern,1)='@' AND lower(NEW.email) LIKE '%'||lower(pattern))) THEN
      RAISE EXCEPTION 'Invalid profile registration';
    END IF;
    RETURN NEW;
  END IF;
  actor := public.require_active_player();
  IF (to_jsonb(NEW) - ARRAY['name','avatar','year_joined','role','updated_at'])
       IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['name','avatar','year_joined','role','updated_at']) THEN
    RAISE EXCEPTION 'Profile identity and statistics are server-managed';
  END IF;
  IF NEW.role IS DISTINCT FROM OLD.role AND (
    actor.role NOT IN ('owner','co_owner') OR OLD.id=actor.id
    OR OLD.role='owner' OR NEW.role IS NULL OR NEW.role='owner'
    OR (actor.role='co_owner' AND (OLD.role='co_owner' OR NEW.role='co_owner'))
  ) THEN RAISE EXCEPTION 'Role change is not permitted'; END IF;
  IF NEW.name IS NULL OR length(trim(NEW.name)) NOT BETWEEN 1 AND 80
     OR NEW.is_external IS DISTINCT FROM (lower(NEW.email) NOT LIKE '%@law-school.de')
     OR (NEW.is_external AND NEW.year_joined IS NOT NULL)
     OR (NOT NEW.is_external AND (
       NEW.year_joined IS NULL OR NEW.year_joined NOT BETWEEN 2000 AND extract(year FROM current_date)::INT
     )) THEN
    RAISE EXCEPTION 'Invalid player details';
  END IF;
  RETURN NEW;
END;
$$;

COMMIT;
