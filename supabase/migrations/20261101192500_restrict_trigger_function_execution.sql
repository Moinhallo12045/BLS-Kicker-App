-- Trigger functions are invoked by PostgreSQL triggers, not by API callers.
REVOKE EXECUTE ON FUNCTION public.prevent_profile_tampering() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_match_write() FROM PUBLIC, anon, authenticated;
