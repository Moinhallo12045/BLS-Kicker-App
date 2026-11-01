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
    role TEXT CHECK (role IN ('admin', 'tournament_director', 'player')) DEFAULT 'player',
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
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5.2 Whitelist Policies
CREATE POLICY "Jeder darf Whitelist einsehen" ON public.whitelist 
FOR SELECT USING (true);

CREATE POLICY "Nur Admins dürfen Whitelist bearbeiten" ON public.whitelist 
FOR ALL TO authenticated 
USING (public.is_admin()) 
WITH CHECK (public.is_admin());

-- 5.3 Profile Policies
CREATE POLICY "Jeder darf Profile lesen" ON public.profiles 
FOR SELECT USING (true);

CREATE POLICY "Nutzer dürfen eigenes Profil bei Registrierung anlegen" ON public.profiles 
FOR INSERT TO authenticated 
WITH CHECK (auth.uid() = auth_user_id);

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
);

-- 5.5 Turniere Policies
CREATE POLICY "Jeder darf Turniere lesen" ON public.tournaments 
FOR SELECT USING (true);

CREATE POLICY "Admins und Turnierleiter dürfen Turniere verwalten" ON public.tournaments 
FOR ALL TO authenticated 
USING (
  public.is_admin() OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.auth_user_id = auth.uid() AND p.role IN ('admin', 'tournament_director')
  )
)
WITH CHECK (
  public.is_admin() OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.auth_user_id = auth.uid() AND p.role IN ('admin', 'tournament_director')
  )
);

-- 5.6 Invite Codes Policies
CREATE POLICY "Jeder darf Einladungscodes prüfen" ON public.invite_codes 
FOR SELECT USING (true);

CREATE POLICY "Nur Admins dürfen Einladungscodes anlegen und bearbeiten" ON public.invite_codes 
FOR ALL TO authenticated 
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Standard-Einladungscode einfügen
INSERT INTO public.invite_codes (code, max_uses, is_active)
VALUES ('KICKER2026', 100, TRUE)
ON CONFLICT (code) DO NOTHING;
