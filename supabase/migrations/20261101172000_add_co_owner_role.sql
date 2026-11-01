ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('owner', 'co_owner', 'admin', 'organiser', 'player'));

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE auth_user_id = auth.uid()
      AND role IN ('owner', 'co_owner', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.prevent_profile_tampering()
RETURNS TRIGGER AS $$
DECLARE
  actor_role TEXT;
BEGIN
  SELECT role INTO actor_role
  FROM public.profiles
  WHERE auth_user_id = auth.uid();

  IF TG_OP = 'INSERT' AND actor_role IS DISTINCT FROM 'owner' THEN
    IF NEW.id IS DISTINCT FROM auth.uid()
       OR NEW.auth_user_id IS DISTINCT FROM auth.uid()
       OR NEW.role <> 'player'
       OR lower(coalesce(NEW.email, '')) <> lower(coalesce(auth.jwt() ->> 'email', ''))
    THEN
      RAISE EXCEPTION 'Invalid profile registration';
    END IF;
    RETURN NEW;
  END IF;

  IF actor_role = 'co_owner'
     AND (OLD.auth_user_id = auth.uid() OR OLD.role = 'owner' OR NEW.role = 'owner') THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Co-owner cannot change their own role, the owner role, or assign the owner role';
    END IF;
  ELSIF actor_role <> 'owner' AND NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Only the owner or an eligible co-owner may change roles';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
