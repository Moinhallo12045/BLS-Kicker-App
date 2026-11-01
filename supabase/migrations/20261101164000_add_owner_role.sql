ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

UPDATE public.profiles
SET role = 'organiser'
WHERE role = 'tournament_director';

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('owner', 'admin', 'organiser', 'player'));

CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE auth_user_id = auth.uid()
      AND role = 'owner'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_master_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN public.is_owner();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN public.is_owner()
    OR EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE auth_user_id = auth.uid()
        AND role IN ('owner', 'admin')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.prevent_profile_tampering()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NOT public.is_admin() THEN
    IF NEW.id IS DISTINCT FROM auth.uid()
       OR NEW.auth_user_id IS DISTINCT FROM auth.uid()
       OR NEW.role <> 'player'
       OR lower(coalesce(NEW.email, '')) <> lower(coalesce(auth.jwt() ->> 'email', ''))
       OR NEW.level <> 1
       OR NEW.xp <> 0
       OR NEW.xp_next_level <> 150
       OR NEW.elo_1v1 <> 1000
       OR NEW.elo_2v2 <> 1000
       OR NEW.elo_total <> 1000
       OR NEW.league_points <> 0
       OR NEW.wins_1v1 <> 0
       OR NEW.losses_1v1 <> 0
       OR NEW.wins_2v2 <> 0
       OR NEW.losses_2v2 <> 0
       OR NEW.current_streak <> 0
       OR NEW.best_rank <> 999
       OR NEW.badges <> '[]'::jsonb
       OR NEW.elo_history <> '[]'::jsonb
    THEN
      RAISE EXCEPTION 'Invalid profile registration';
    END IF;
    RETURN NEW;
  END IF;

  IF NOT public.is_owner() THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Only the owner may change roles';
    END IF;

    IF NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id
       OR NEW.email IS DISTINCT FROM OLD.email
       OR NEW.xp IS DISTINCT FROM OLD.xp
       OR NEW.xp_next_level IS DISTINCT FROM OLD.xp_next_level
       OR NEW.elo_1v1 IS DISTINCT FROM OLD.elo_1v1
       OR NEW.elo_2v2 IS DISTINCT FROM OLD.elo_2v2
       OR NEW.elo_total IS DISTINCT FROM OLD.elo_total
       OR NEW.league_points IS DISTINCT FROM OLD.league_points
       OR NEW.wins_1v1 IS DISTINCT FROM OLD.wins_1v1
       OR NEW.losses_1v1 IS DISTINCT FROM OLD.losses_1v1
       OR NEW.wins_2v2 IS DISTINCT FROM OLD.wins_2v2
       OR NEW.losses_2v2 IS DISTINCT FROM OLD.losses_2v2
       OR NEW.current_streak IS DISTINCT FROM OLD.current_streak
       OR NEW.best_rank IS DISTINCT FROM OLD.best_rank
       OR NEW.badges IS DISTINCT FROM OLD.badges
       OR NEW.elo_history IS DISTINCT FROM OLD.elo_history
    THEN
      RAISE EXCEPTION 'Profile statistics and authorization fields are server-managed';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
