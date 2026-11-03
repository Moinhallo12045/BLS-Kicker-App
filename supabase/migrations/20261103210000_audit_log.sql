BEGIN;

CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  actor_id UUID,
  actor_name TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('score_corrected','match_cancelled','player_deleted')),
  target_id UUID NOT NULL,
  before JSONB NOT NULL,
  after JSONB NOT NULL
);
CREATE INDEX audit_log_recent_idx ON public.audit_log(created_at DESC,id DESC);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.audit_log FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.audit_log TO authenticated;
CREATE POLICY "Administration liest Änderungsprotokoll" ON public.audit_log
FOR SELECT TO authenticated USING ((SELECT public.is_admin()));

CREATE FUNCTION public.record_audit_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE actor public.profiles; event TEXT; old_values JSONB; new_values JSONB;
BEGIN
  IF TG_TABLE_NAME='matches' THEN
    IF NEW.status='cancelled' AND OLD.status IS DISTINCT FROM NEW.status THEN
      event := 'match_cancelled';
    ELSIF ROW(OLD.score_a,OLD.score_b) IS DISTINCT FROM ROW(NEW.score_a,NEW.score_b) THEN
      event := 'score_corrected';
    ELSE RETURN NEW;
    END IF;
    old_values := jsonb_build_object('score_a',OLD.score_a,'score_b',OLD.score_b,'status',OLD.status);
    new_values := jsonb_build_object('score_a',NEW.score_a,'score_b',NEW.score_b,'status',NEW.status);
  ELSE
    IF NOT NEW.is_deleted OR OLD.is_deleted THEN RETURN NEW; END IF;
    UPDATE public.audit_log SET actor_name=NEW.name WHERE actor_id=NEW.id;
    event := 'player_deleted';
    old_values := jsonb_build_object('is_deleted',false);
    new_values := jsonb_build_object('is_deleted',true);
  END IF;
  SELECT * INTO actor FROM public.profiles WHERE auth_user_id=auth.uid();
  INSERT INTO public.audit_log(actor_id,actor_name,action,target_id,before,after)
  VALUES(actor.id,coalesce(actor.name,'System'),event,NEW.id,old_values,new_values);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.record_audit_change() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER record_match_audit AFTER UPDATE OF score_a,score_b,status ON public.matches
FOR EACH ROW EXECUTE FUNCTION public.record_audit_change();
CREATE TRIGGER record_player_deletion_audit AFTER UPDATE OF is_deleted ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.record_audit_change();

COMMIT;
