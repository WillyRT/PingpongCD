-- ==============================================================================
-- TourneyMaster AI - Master Consolidated Database Schema & Evolution Migration
-- Project: TourneyMaster AI
-- Version: 2.5 (Fully Consolidated & Hardened)
-- Tables: 16 Schema Entities + RBAC + Historical Archive + Realtime
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. PROFILES & USERS (Decoupled from auth.users for public registration)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  nickname TEXT,
  email TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'player' CHECK (role IN ('super_admin', 'admin', 'player')),
  admin_status TEXT NOT NULL DEFAULT 'none' CHECK (admin_status IN ('none', 'pending', 'approved', 'rejected')),
  declared_level NUMERIC(3,1) CHECK (declared_level IS NULL OR (declared_level >= 0 AND declared_level <= 10)),
  birth_date DATE,
  category TEXT CHECK (category IS NULL OR category IN ('sub14', 'plus14')),
  rating DOUBLE PRECISION NOT NULL DEFAULT 1500,
  rating_deviation DOUBLE PRECISION NOT NULL DEFAULT 350,
  volatility DOUBLE PRECISION NOT NULL DEFAULT 0.06,
  matches_played INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique indexes on user_id (when linked) and lowercased email
CREATE UNIQUE INDEX IF NOT EXISTS profiles_user_id_idx ON public.profiles(user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_lower_idx ON public.profiles(LOWER(email)) WHERE email IS NOT NULL AND email <> '';

-- Auto-create or link profile on auth signup & designate superadmin for guillermoriveraterriza@gmail.com
-- 100% resilient to nulls or missing metadata from Magic Links
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_role text := 'player';
  v_status text := 'none';
  v_nickname text;
BEGIN
  IF LOWER(NEW.email) = 'guillermoriveraterriza@gmail.com' THEN
    v_role := 'super_admin';
    v_status := 'approved';
  END IF;

  v_nickname := COALESCE(
    NEW.raw_user_meta_data->>'nickname',
    NEW.raw_user_meta_data->>'name',
    SPLIT_PART(NEW.email, '@', 1),
    'Jugador'
  );

  IF EXISTS (SELECT 1 FROM public.profiles WHERE LOWER(email) = LOWER(NEW.email)) THEN
    UPDATE public.profiles
    SET
      user_id = NEW.id,
      email = LOWER(NEW.email),
      nickname = COALESCE(public.profiles.nickname, v_nickname),
      name = COALESCE(public.profiles.name, v_nickname),
      role = CASE WHEN LOWER(NEW.email) = 'guillermoriveraterriza@gmail.com' THEN 'super_admin' ELSE public.profiles.role END,
      admin_status = CASE WHEN LOWER(NEW.email) = 'guillermoriveraterriza@gmail.com' THEN 'approved' ELSE public.profiles.admin_status END,
      updated_at = NOW()
    WHERE LOWER(email) = LOWER(NEW.email);
  ELSE
    INSERT INTO public.profiles (id, user_id, email, nickname, name, role, admin_status, created_at, updated_at)
    VALUES (NEW.id, NEW.id, LOWER(NEW.email), v_nickname, v_nickname, v_role, v_status, NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      user_id = EXCLUDED.user_id,
      nickname = COALESCE(public.profiles.nickname, EXCLUDED.nickname),
      name = COALESCE(public.profiles.name, EXCLUDED.name),
      role = CASE WHEN LOWER(EXCLUDED.email) = 'guillermoriveraterriza@gmail.com' THEN 'super_admin' ELSE public.profiles.role END,
      admin_status = CASE WHEN LOWER(EXCLUDED.email) = 'guillermoriveraterriza@gmail.com' THEN 'approved' ELSE public.profiles.admin_status END,
      updated_at = NOW();
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error en handle_new_user: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Helper function: is_admin (Safe SECURITY DEFINER with fixed search_path)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE (user_id = auth.uid() OR id = auth.uid())
      AND role IN ('admin', 'super_admin')
      AND admin_status = 'approved'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Helper function: is_super_admin (Safe SECURITY DEFINER with fixed search_path)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE (user_id = auth.uid() OR id = auth.uid())
      AND role = 'super_admin'
      AND admin_status = 'approved'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Helper function: update_updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- 2. TOURNAMENTS (5 Canonical States)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'registration', 'group_stage', 'bracket_stage', 'finished')),
  hidden_standings BOOLEAN NOT NULL DEFAULT false,
  start_date DATE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER update_tournaments_updated_at
  BEFORE UPDATE ON public.tournaments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- 3. TOURNAMENT CONFIG
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tournament_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL UNIQUE REFERENCES public.tournaments(id) ON DELETE CASCADE,
  total_players INTEGER,
  group_count INTEGER,
  group_sizes INTEGER[],
  hidden_standings BOOLEAN NOT NULL DEFAULT false,
  group_target_points INTEGER NOT NULL DEFAULT 7,
  knockout_target_points INTEGER NOT NULL DEFAULT 11,
  final_target_points INTEGER NOT NULL DEFAULT 15,
  min_difference INTEGER NOT NULL DEFAULT 2,
  qualifiers_per_group INTEGER NOT NULL DEFAULT 2,
  competitive_balance_index NUMERIC(5,4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER update_tournament_config_updated_at
  BEFORE UPDATE ON public.tournament_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- 4. TOURNAMENT GROUPS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tournament_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'plus14' CHECK (category IN ('sub14', 'plus14')),
  group_letter CHAR(1) NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  expected_matches INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT unique_group_per_category UNIQUE (tournament_id, category, group_letter)
);

-- ============================================================
-- 5. TOURNAMENT PARTICIPANTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tournament_participants (
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  group_id UUID REFERENCES public.tournament_groups(id) ON DELETE SET NULL,
  category TEXT NOT NULL DEFAULT 'plus14' CHECK (category IN ('sub14', 'plus14')),
  declared_level NUMERIC(3,1) CHECK (declared_level IS NULL OR (declared_level >= 0 AND declared_level <= 10)),
  seed INTEGER,
  confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tournament_id, user_id)
);

-- ============================================================
-- 6. MATCHES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  group_id UUID REFERENCES public.tournament_groups(id) ON DELETE SET NULL,
  category TEXT NOT NULL DEFAULT 'plus14' CHECK (category IN ('sub14', 'plus14')),
  stage TEXT NOT NULL CHECK (stage IN ('group', 'round_of_16', 'quarterfinal', 'semifinal', 'final')),
  player1_id UUID NOT NULL REFERENCES public.profiles(id),
  player2_id UUID NOT NULL REFERENCES public.profiles(id),
  score_player1 INTEGER,
  score_player2 INTEGER,
  winner_id UUID REFERENCES public.profiles(id),
  reported_by UUID REFERENCES public.profiles(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'confirmed', 'disputed')),
  win_expectancy_p1 NUMERIC(4,3),
  win_expectancy_p2 NUMERIC(4,3),
  is_upset BOOLEAN DEFAULT false,
  next_match_id UUID REFERENCES public.matches(id),
  next_slot INTEGER CHECK (next_slot IN (1, 2)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT different_players CHECK (player1_id <> player2_id)
);

CREATE TRIGGER update_matches_updated_at
  BEFORE UPDATE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- 7. MATCH REPORTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.match_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  reported_by UUID NOT NULL REFERENCES public.profiles(id),
  score_player1 INTEGER NOT NULL CHECK (score_player1 >= 0),
  score_player2 INTEGER NOT NULL CHECK (score_player2 >= 0),
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'confirmed', 'disputed', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 8. AUDIT LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE,
  match_id REFERENCES public.matches(id) ON DELETE CASCADE,
  performed_by UUID NOT NULL REFERENCES public.profiles(id),
  action TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 9. CANONICAL PLAYERS & ALIASES (HISTORICAL ARCHIVE)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER update_players_updated_at
  BEFORE UPDATE ON public.players
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE IF NOT EXISTS public.player_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  normalized_alias TEXT NOT NULL,
  source_system TEXT NOT NULL DEFAULT 'historical_archive',
  confidence DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_player_alias UNIQUE (player_id, normalized_alias)
);

CREATE INDEX IF NOT EXISTS idx_player_aliases_normalized ON public.player_aliases(normalized_alias);

-- ============================================================
-- 10. HISTORICAL TOURNAMENTS, GROUPS, MATCHES & RATINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.historical_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_year INTEGER NOT NULL,
  total_matches INTEGER NOT NULL DEFAULT 0,
  total_players INTEGER NOT NULL DEFAULT 0,
  imported_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.historical_tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  year INTEGER NOT NULL,
  tournament_date DATE,
  slug TEXT NOT NULL UNIQUE,
  is_complete BOOLEAN NOT NULL DEFAULT true,
  import_batch_id UUID REFERENCES public.historical_imports(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.historical_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  historical_tournament_id UUID NOT NULL REFERENCES public.historical_tournaments(id) ON DELETE CASCADE,
  group_code TEXT NOT NULL,
  total_players INTEGER NOT NULL DEFAULT 0,
  total_matches INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_tournament_group UNIQUE (historical_tournament_id, group_code)
);

CREATE TABLE IF NOT EXISTS public.historical_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  historical_tournament_id UUID NOT NULL REFERENCES public.historical_tournaments(id) ON DELETE CASCADE,
  group_id UUID REFERENCES public.historical_groups(id) ON DELETE SET NULL,
  stage TEXT NOT NULL DEFAULT 'group',
  player1_id UUID NOT NULL REFERENCES public.players(id),
  player2_id UUID NOT NULL REFERENCES public.players(id),
  score_player1 INTEGER NOT NULL DEFAULT 0,
  score_player2 INTEGER NOT NULL DEFAULT 0,
  winner_id UUID REFERENCES public.players(id),
  status TEXT NOT NULL DEFAULT 'complete',
  is_missing BOOLEAN NOT NULL DEFAULT false,
  played_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT different_historical_players CHECK (player1_id <> player2_id)
);

CREATE TABLE IF NOT EXISTS public.rating_states (
  player_id UUID PRIMARY KEY REFERENCES public.players(id) ON DELETE CASCADE,
  rating DOUBLE PRECISION NOT NULL DEFAULT 1500,
  rating_deviation DOUBLE PRECISION NOT NULL DEFAULT 350,
  volatility DOUBLE PRECISION NOT NULL DEFAULT 0.06,
  matches_played INTEGER NOT NULL DEFAULT 0,
  last_tournament_year INTEGER,
  last_played_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rating_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  rating_period_id UUID REFERENCES public.historical_tournaments(id) ON DELETE SET NULL,
  rating_before DOUBLE PRECISION NOT NULL,
  rd_before DOUBLE PRECISION NOT NULL,
  vol_before DOUBLE PRECISION NOT NULL,
  rating_after DOUBLE PRECISION NOT NULL,
  rd_after DOUBLE PRECISION NOT NULL,
  vol_after DOUBLE PRECISION NOT NULL,
  matches_in_period INTEGER NOT NULL DEFAULT 0,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_player_period_snapshot UNIQUE (player_id, rating_period_id)
);

-- ============================================================
-- 11. SECURED STORED PROCEDURES
-- ============================================================

-- Drop vulnerable legacy signatures
DROP FUNCTION IF EXISTS public.confirm_match(UUID, UUID);

-- Blinded confirm_match deriving identity safely from auth.uid()
CREATE OR REPLACE FUNCTION public.confirm_match(
  p_match_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_match RECORD;
  v_report RECORD;
  v_winner_id UUID;
  v_caller_id UUID;
BEGIN
  v_caller_id := auth.uid();

  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match not found');
  END IF;

  IF v_match.status = 'confirmed' THEN
    RETURN jsonb_build_object('success', true, 'message', 'Match already confirmed');
  END IF;

  -- Verify authorization if caller is an authenticated user
  IF v_caller_id IS NOT NULL THEN
    IF v_caller_id <> v_match.player1_id AND v_caller_id <> v_match.player2_id THEN
      IF NOT public.is_admin() THEN
        RETURN jsonb_build_object('success', false, 'error', 'Only match participants or admins can confirm');
      END IF;
    END IF;

    IF v_caller_id = v_match.reported_by AND NOT public.is_admin() THEN
      RETURN jsonb_build_object('success', false, 'error', 'Reporter cannot confirm their own report');
    END IF;
  END IF;

  SELECT * INTO v_report FROM public.match_reports
  WHERE match_id = p_match_id ORDER BY created_at DESC LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'No score report found');
  END IF;

  IF v_report.score_player1 > v_report.score_player2 THEN
    v_winner_id := v_match.player1_id;
  ELSE
    v_winner_id := v_match.player2_id;
  END IF;

  UPDATE public.matches SET
    score_player1 = v_report.score_player1,
    score_player2 = v_report.score_player2,
    winner_id = v_winner_id,
    status = 'confirmed',
    updated_at = now()
  WHERE id = p_match_id;

  UPDATE public.match_reports SET status = 'confirmed' WHERE id = v_report.id;

  IF v_match.next_match_id IS NOT NULL AND v_match.next_slot IS NOT NULL THEN
    IF v_match.next_slot = 1 THEN
      UPDATE public.matches SET player1_id = v_winner_id, updated_at = now() WHERE id = v_match.next_match_id;
    ELSE
      UPDATE public.matches SET player2_id = v_winner_id, updated_at = now() WHERE id = v_match.next_match_id;
    END IF;
  END IF;

  INSERT INTO public.audit_logs (tournament_id, match_id, performed_by, action, payload)
  VALUES (
    v_match.tournament_id,
    p_match_id,
    COALESCE(v_caller_id, v_match.player1_id),
    'confirm_match',
    jsonb_build_object(
      'winner_id', v_winner_id,
      'score1', v_report.score_player1,
      'score2', v_report.score_player2
    )
  );

  RETURN jsonb_build_object('success', true, 'winner_id', v_winner_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Revoke public access to confirm_match, granting execution exclusively to service_role
REVOKE ALL ON FUNCTION public.confirm_match(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_match(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.confirm_match(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_match(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.resolve_dispute(
  p_match_id UUID,
  p_admin_id UUID,
  p_resolution TEXT,
  p_score_player1 INTEGER DEFAULT NULL,
  p_score_player2 INTEGER DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_match RECORD;
  v_winner_id UUID;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Admin authorization required');
  END IF;

  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match not found');
  END IF;

  IF p_resolution = 'accept_score' THEN
    IF v_match.score_player1 > v_match.score_player2 THEN
      v_winner_id := v_match.player1_id;
    ELSE
      v_winner_id := v_match.player2_id;
    END IF;
    UPDATE public.matches SET winner_id = v_winner_id, status = 'confirmed', updated_at = now() WHERE id = p_match_id;
  ELSIF p_resolution = 'modify_score' THEN
    IF p_score_player1 IS NULL OR p_score_player2 IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Scores required for modify_score');
    END IF;
    IF p_score_player1 > p_score_player2 THEN
      v_winner_id := v_match.player1_id;
    ELSE
      v_winner_id := v_match.player2_id;
    END IF;
    UPDATE public.matches SET
      score_player1 = p_score_player1,
      score_player2 = p_score_player2,
      winner_id = v_winner_id,
      status = 'confirmed',
      updated_at = now()
    WHERE id = p_match_id;
  ELSIF p_resolution = 'reopen_match' THEN
    UPDATE public.matches SET
      score_player1 = NULL,
      score_player2 = NULL,
      winner_id = NULL,
      reported_by = NULL,
      status = 'pending',
      updated_at = now()
    WHERE id = p_match_id;
  ELSIF p_resolution = 'cancel_match' THEN
    UPDATE public.matches SET status = 'pending', updated_at = now() WHERE id = p_match_id;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Invalid resolution mode');
  END IF;

  INSERT INTO public.audit_logs (tournament_id, match_id, performed_by, action, payload)
  VALUES (
    v_match.tournament_id,
    p_match_id,
    p_admin_id,
    'resolve_dispute',
    jsonb_build_object('resolution', p_resolution, 'winner_id', v_winner_id)
  );

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ============================================================
-- 12. ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historical_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historical_tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historical_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historical_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rating_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rating_snapshots ENABLE ROW LEVEL SECURITY;

-- Profiles: anyone can view, users can update own, service role / admin can manage
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = id);
CREATE POLICY "Service role full access on profiles" ON public.profiles FOR ALL USING (true);

-- Tournaments: viewable by all, editable by admins
CREATE POLICY "Tournaments are viewable by everyone" ON public.tournaments FOR SELECT USING (true);
CREATE POLICY "Admins can insert tournaments" ON public.tournaments FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update tournaments" ON public.tournaments FOR UPDATE USING (public.is_admin());
CREATE POLICY "Admins can delete tournaments" ON public.tournaments FOR DELETE USING (public.is_admin());

-- Tournament Config: viewable by all, editable by admins
CREATE POLICY "Config viewable by everyone" ON public.tournament_config FOR SELECT USING (true);
CREATE POLICY "Admins can manage config" ON public.tournament_config FOR ALL USING (public.is_admin());

-- Tournament Groups: viewable by all, editable by admins
CREATE POLICY "Groups viewable by everyone" ON public.tournament_groups FOR SELECT USING (true);
CREATE POLICY "Admins can manage groups" ON public.tournament_groups FOR ALL USING (public.is_admin());

-- Tournament Participants: viewable by all, public/users can register, admins can manage
CREATE POLICY "Participants viewable by everyone" ON public.tournament_participants FOR SELECT USING (true);
CREATE POLICY "Public or users can register participants" ON public.tournament_participants FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can manage participants" ON public.tournament_participants FOR ALL USING (public.is_admin());

-- Matches: viewable by all, participants/admins can update
CREATE POLICY "Matches viewable by everyone" ON public.matches FOR SELECT USING (true);
CREATE POLICY "Admins can manage all matches" ON public.matches FOR ALL USING (public.is_admin());
CREATE POLICY "Participants can update their matches" ON public.matches FOR UPDATE USING (auth.uid() = player1_id OR auth.uid() = player2_id);

-- Match Reports: viewable by participants and admins
CREATE POLICY "Reports viewable by participants and admins" ON public.match_reports FOR SELECT USING (
  public.is_admin() OR
  EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = match_id AND (m.player1_id = auth.uid() OR m.player2_id = auth.uid())
  )
);
CREATE POLICY "Participants can submit reports" ON public.match_reports FOR INSERT WITH CHECK (
  (auth.uid() = reported_by OR public.is_admin()) AND
  EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = match_id AND (m.player1_id = auth.uid() OR m.player2_id = auth.uid())
  )
);

-- Audit Logs: viewable only by admins
CREATE POLICY "Admins can view audit logs" ON public.audit_logs FOR SELECT USING (public.is_admin());

-- Historical tables: read-only for public, writable by admin/service role
CREATE POLICY "Players viewable by everyone" ON public.players FOR SELECT USING (true);
CREATE POLICY "Player aliases viewable by everyone" ON public.player_aliases FOR SELECT USING (true);
CREATE POLICY "Historical tournaments viewable by everyone" ON public.historical_tournaments FOR SELECT USING (true);
CREATE POLICY "Historical groups viewable by everyone" ON public.historical_groups FOR SELECT USING (true);
CREATE POLICY "Historical matches viewable by everyone" ON public.historical_matches FOR SELECT USING (true);
CREATE POLICY "Rating states viewable by everyone" ON public.rating_states FOR SELECT USING (true);
CREATE POLICY "Rating snapshots viewable by everyone" ON public.rating_snapshots FOR SELECT USING (true);

-- ============================================================
-- 13. REALTIME PUBLICATION
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.tournaments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_groups;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.match_reports;
