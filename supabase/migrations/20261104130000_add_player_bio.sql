BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bio TEXT NOT NULL DEFAULT '';
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_bio_length_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_bio_length_check CHECK (length(bio) <= 160);
GRANT SELECT (bio) ON public.profiles TO anon, authenticated;

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
  IF (to_jsonb(NEW) - ARRAY['name','avatar','bio','year_joined','role','updated_at'])
       IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['name','avatar','bio','year_joined','role','updated_at']) THEN
    RAISE EXCEPTION 'Profile identity and statistics are server-managed';
  END IF;
  IF NEW.role IS DISTINCT FROM OLD.role AND (
    actor.role NOT IN ('owner','co_owner') OR OLD.id=actor.id
    OR OLD.role='owner' OR NEW.role IS NULL OR NEW.role='owner'
    OR (actor.role='co_owner' AND (OLD.role='co_owner' OR NEW.role='co_owner'))
  ) THEN RAISE EXCEPTION 'Role change is not permitted'; END IF;
  IF NEW.name IS NULL OR length(trim(NEW.name)) NOT BETWEEN 1 AND 80
     OR NEW.bio IS NULL OR length(NEW.bio) > 160
     OR NEW.year_joined IS NULL OR NEW.year_joined NOT BETWEEN 2000 AND extract(year FROM current_date)::INT THEN
    RAISE EXCEPTION 'Invalid player details';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_player(p_player_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE actor public.profiles; target public.profiles; prior TEXT := current_setting('app.server_operation',true);
BEGIN
  PERFORM pg_advisory_xact_lock(20261101,210000);
  actor := public.require_active_player();
  IF actor.role IS NULL OR actor.role NOT IN ('owner','co_owner') THEN
    RAISE EXCEPTION 'Nur Owner und Co-Owner dürfen Spieler löschen.';
  END IF;
  SELECT * INTO target FROM public.profiles WHERE id=p_player_id FOR UPDATE;
  IF target.id IS NULL THEN RAISE EXCEPTION 'Spieler nicht gefunden.'; END IF;
  IF target.id=actor.id OR target.role='owner' THEN
    RAISE EXCEPTION 'Der eigene Account und Owner-Profile dürfen nicht gelöscht werden.';
  END IF;
  IF target.is_deleted THEN RETURN; END IF;
  PERFORM set_config('app.server_operation','true',true);
  UPDATE public.profiles SET is_deleted=true,is_suspended=true,auth_user_id=NULL,
    role='player',name='Gelöschter Spieler '||id::TEXT,avatar='⚽',bio='',email=NULL,
    year_joined=NULL,is_external=false,updated_at=now() WHERE id=p_player_id;
  PERFORM set_config('app.server_operation',coalesce(prior,''),true);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_player(UUID) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.delete_player(UUID) TO authenticated;

COMMIT;
