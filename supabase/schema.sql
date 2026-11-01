-- ====================================================================
-- KICKER LEAGUE - Supabase SQL Schema (Kostenlose Tier-Optimierung)
-- ====================================================================

-- 1. PROFILES (Spielerprofile)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL UNIQUE,
    avatar TEXT DEFAULT '⚽',
    email TEXT,
    year_joined INT DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
    level INT DEFAULT 1,
    xp INT DEFAULT 0,
    xp_next_level INT DEFAULT 150,
    elo_1v1 INT DEFAULT 1000,
    elo_2v2 INT DEFAULT 1000,
    elo_total INT DEFAULT 1000,
    league_points INT DEFAULT 0,
    wins_1v1 INT DEFAULT 0,
    losses_1v1 INT DEFAULT 0,
    wins_2v2 INT DEFAULT 0,
    losses_2v2 INT DEFAULT 0,
    current_streak INT DEFAULT 0,
    best_rank INT DEFAULT 999,
    role TEXT CHECK (role IN ('owner', 'admin', 'organiser', 'player')) DEFAULT 'player',
    badges JSONB DEFAULT '[]'::jsonb,
    elo_history JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. MATCHES (Spiele & Ergebnisse)
CREATE TABLE IF NOT EXISTS public.matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mode TEXT CHECK (mode IN ('1v1', '2v2')) NOT NULL,
    creator_id UUID REFERENCES public.profiles(id),
    team_a UUID[] NOT NULL,
    team_b UUID[] NOT NULL,
    score_a INT NOT NULL,
    score_b INT NOT NULL,
    status TEXT CHECK (status IN ('pending', 'confirmed', 'disputed', 'cancelled')) DEFAULT 'pending',
    confirmed_by UUID[] DEFAULT '{}',
    disputed_by UUID REFERENCES public.profiles(id),
    dispute_reason TEXT,
    elo_change_a INT DEFAULT 0,
    elo_change_b INT DEFAULT 0,
    tournament_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TOURNAMENTS (Turniere)
CREATE TABLE IF NOT EXISTS public.tournaments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    type TEXT CHECK (type IN ('ko', 'groups', 'round_robin')) NOT NULL,
    mode TEXT CHECK (mode IN ('1v1', '2v2')) NOT NULL,
    status TEXT CHECK (status IN ('upcoming', 'running', 'completed')) DEFAULT 'upcoming',
    participants UUID[] DEFAULT '{}',
    matches JSONB DEFAULT '[]'::jsonb,
    winner_id UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. INVITE CODES & WHITELIST (Geschlossene Registrierung)
CREATE TABLE IF NOT EXISTS public.invite_codes (
    code TEXT PRIMARY KEY,
    created_by UUID REFERENCES public.profiles(id),
    used_by UUID[] DEFAULT '{}',
    max_uses INT DEFAULT 50,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.whitelist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pattern TEXT NOT NULL UNIQUE,
    added_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whitelist ENABLE ROW LEVEL SECURITY;

-- 5.1 Hilfsfunktion: Prüft ob der aktuelle User Administrator ist
CREATE OR REPLACE FUNCTION public.is_master_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN public.is_owner();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

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

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = auth.uid() AND role IN ('owner', 'admin')
  ) OR public.is_owner();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_email_whitelisted(candidate_email TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  normalized_email TEXT := lower(trim(candidate_email));
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.whitelist
    WHERE lower(pattern) = normalized_email
       OR (left(pattern, 1) = '@' AND normalized_email LIKE '%' || lower(pattern))
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.is_email_whitelisted(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_email_whitelisted(TEXT) TO authenticated;

-- 5.2 Whitelist Policies
CREATE POLICY "Nur Admins dürfen Whitelist bearbeiten" ON public.whitelist 
FOR ALL TO authenticated 
USING (public.is_admin()) 
WITH CHECK (public.is_admin());

-- 5.3 Profile Policies
CREATE POLICY "Jeder darf Profile lesen" ON public.profiles 
FOR SELECT USING (true);

CREATE POLICY "Nutzer dürfen eigenes Profil bei Registrierung anlegen" ON public.profiles 
FOR INSERT TO authenticated 
WITH CHECK (
  auth.uid() = auth_user_id
  AND (role = 'player' OR public.is_master_admin())
);

CREATE POLICY "Nutzer dürfen eigenes Profil bearbeiten ohne Rollen-Eskalation" ON public.profiles 
FOR UPDATE TO authenticated 
USING (auth.uid() = auth_user_id OR public.is_admin())
WITH CHECK (
  public.is_admin() OR (
    auth.uid() = auth_user_id AND
    role = (SELECT p.role FROM public.profiles p WHERE p.auth_user_id = auth.uid())
  )
);

-- 5.4 Matches Policies
CREATE POLICY "Jeder darf Matches lesen" ON public.matches 
FOR SELECT USING (true);

CREATE POLICY "Authentifizierte Spieler dürfen Matches melden" ON public.matches 
FOR INSERT TO authenticated 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Beteiligte Spieler und Admins dürfen Matches aktualisieren" ON public.matches 
FOR UPDATE TO authenticated 
USING (
  public.is_admin() OR
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.auth_user_id = auth.uid()
      AND (p.id = ANY(team_a) OR p.id = ANY(team_b) OR p.id = creator_id)
  )
)
WITH CHECK (
  public.is_admin() OR
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.auth_user_id = auth.uid()
      AND (p.id = ANY(team_a) OR p.id = ANY(team_b) OR p.id = creator_id)
  )
);

-- 5.5 Turniere Policies
CREATE POLICY "Jeder darf Turniere lesen" ON public.tournaments 
FOR SELECT USING (true);

CREATE POLICY "Admins und Turnierleiter dürfen Turniere verwalten" ON public.tournaments 
FOR ALL TO authenticated 
USING (
  public.is_admin() OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.auth_user_id = auth.uid() AND p.role IN ('owner', 'admin', 'organiser')
  )
)
WITH CHECK (
  public.is_admin() OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.auth_user_id = auth.uid() AND p.role IN ('owner', 'admin', 'organiser')
  )
);

-- 5.6 Invite Codes Policies
CREATE POLICY "Nur Admins dürfen Einladungscodes anlegen und bearbeiten" ON public.invite_codes 
FOR ALL TO authenticated 
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.consume_invite_code(candidate_code TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  normalized_code TEXT := upper(trim(candidate_code));
  actor UUID := auth.uid();
BEGIN
  IF actor IS NULL THEN
    RETURN FALSE;
  END IF;

  UPDATE public.invite_codes
  SET used_by = array_append(used_by, actor)
  WHERE code = normalized_code
    AND is_active
    AND NOT (actor = ANY(used_by))
    AND cardinality(used_by) < max_uses;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.consume_invite_code(TEXT) TO authenticated;

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

DROP TRIGGER IF EXISTS protect_profile_fields ON public.profiles;
CREATE TRIGGER protect_profile_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_tampering();

CREATE OR REPLACE FUNCTION public.validate_match_write()
RETURNS TRIGGER AS $$
DECLARE
  actor_profile UUID;
BEGIN
  SELECT id INTO actor_profile
  FROM public.profiles
  WHERE auth_user_id = auth.uid();

  IF actor_profile IS NULL THEN
    RAISE EXCEPTION 'A linked player profile is required';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.creator_id IS DISTINCT FROM actor_profile
       OR NOT (actor_profile = ANY(NEW.team_a) OR actor_profile = ANY(NEW.team_b))
       OR (NEW.mode = '1v1' AND (cardinality(NEW.team_a) <> 1 OR cardinality(NEW.team_b) <> 1))
       OR (NEW.mode = '2v2' AND (cardinality(NEW.team_a) <> 2 OR cardinality(NEW.team_b) <> 2))
       OR NEW.team_a && NEW.team_b
       OR NEW.score_a < 0
       OR NEW.score_b < 0
       OR NEW.status <> 'pending'
       OR NEW.confirmed_by <> ARRAY[actor_profile]::UUID[]
       OR NEW.elo_change_a <> 0
       OR NEW.elo_change_b <> 0
    THEN
      RAISE EXCEPTION 'Invalid match submission';
    END IF;
  ELSIF NOT public.is_admin() THEN
    IF NEW.creator_id IS DISTINCT FROM OLD.creator_id
       OR NEW.team_a IS DISTINCT FROM OLD.team_a
       OR NEW.team_b IS DISTINCT FROM OLD.team_b
       OR NEW.score_a IS DISTINCT FROM OLD.score_a
       OR NEW.score_b IS DISTINCT FROM OLD.score_b
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.elo_change_a IS DISTINCT FROM OLD.elo_change_a
       OR NEW.elo_change_b IS DISTINCT FROM OLD.elo_change_b
       OR NEW.tournament_id IS DISTINCT FROM OLD.tournament_id
       OR NOT (
         OLD.confirmed_by <@ NEW.confirmed_by
         AND NEW.confirmed_by <@ array_append(OLD.confirmed_by, actor_profile)
       )
    THEN
      RAISE EXCEPTION 'Match ownership, scores, status, and ranking fields are server-managed';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS validate_match_write ON public.matches;
CREATE TRIGGER validate_match_write
  BEFORE INSERT OR UPDATE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.validate_match_write();
