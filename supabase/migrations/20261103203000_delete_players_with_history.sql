BEGIN;

ALTER TABLE public.profiles ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.profiles ADD CONSTRAINT deleted_profile_inactive
  CHECK (NOT is_deleted OR (is_suspended AND auth_user_id IS NULL AND role='player'));
GRANT SELECT (is_deleted) ON public.profiles TO anon,authenticated;

CREATE FUNCTION public.protect_deleted_profile()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF OLD.is_deleted AND NOT NEW.is_deleted THEN
    RAISE EXCEPTION 'Gelöschte Spieler können nicht reaktiviert werden.';
  END IF;
  IF NEW.is_deleted IS DISTINCT FROM OLD.is_deleted
    AND current_setting('app.server_operation',true) IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'Spieler dürfen nur über die Löschfunktion gelöscht werden.';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER protect_deleted_profile BEFORE UPDATE OF is_deleted ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_deleted_profile();
REVOKE ALL ON FUNCTION public.protect_deleted_profile() FROM PUBLIC,anon,authenticated;

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
    role='player',name='Gelöschter Spieler '||id::TEXT,avatar='⚽',email=NULL,
    year_joined=NULL,is_external=false,updated_at=now() WHERE id=p_player_id;
  PERFORM set_config('app.server_operation',coalesce(prior,''),true);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_player(UUID) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.delete_player(UUID) TO authenticated;

COMMIT;
