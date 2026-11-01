-- Only for a disposable, empty PostgreSQL test database.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
END;
$$;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id UUID PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::UUID;
$$;
CREATE FUNCTION auth.jwt() RETURNS JSONB LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::JSONB;
$$;

\ir ../schema.sql

-- schema.sql already contains these later policies. Remove them so that the
-- historical migrations can recreate them in their original order.
DROP POLICY "Admins und Turnierleiter dürfen Turniere anlegen" ON public.tournaments;
DROP POLICY "Admins und Turnierleiter dürfen Turniere bearbeiten" ON public.tournaments;
DROP POLICY "Admins und Turnierleiter dürfen Turniere löschen" ON public.tournaments;

\ir ../migrations/20261101153100_fix_master_admin_whitelist.sql
\ir ../migrations/20261101162300_create_whitelist_table.sql
\ir ../migrations/20261101164000_add_owner_role.sql
\ir ../migrations/20261101171000_close_whitelist_oracle.sql
\ir ../migrations/20261101172000_add_co_owner_role.sql
\ir ../migrations/20261101174000_create_player_profile_rpc.sql
\ir ../migrations/20261101190000_server_match_scoring.sql
\ir ../migrations/20261101191500_add_player_suspension.sql
\ir ../migrations/20261101192000_harden_rls_and_rpc_grants.sql
\ir ../migrations/20261101192500_restrict_trigger_function_execution.sql
\ir ../migrations/20261101193500_consolidate_rls_policies.sql
\ir ../migrations/20261101194000_harden_match_submission.sql
\ir ../migrations/20261101201000_persist_match_status_changes.sql
\ir ../migrations/20261101203000_rollback_cancelled_match_stats.sql

GRANT USAGE ON SCHEMA public, auth TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
