-- TourneyMaster AI - Complete Master Schema Migration
-- Includes:
-- 1. Core live tournament tables (profiles, tournaments, tournament_config, tournament_groups,
--    tournament_participants, matches, match_reports, audit_logs)
-- 2. Historical archive architecture (players, player_aliases, historical_imports,
--    historical_tournaments, historical_groups, historical_matches, rating_states, rating_snapshots)
-- 3. Stored procedures (confirm_match, resolve_dispute, record_audit_log)
-- 4. Complete Row Level Security (RLS) policies
-- 5. Supabase Realtime publication setup

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'player' CHECK (role IN ('admin', 'player')),
  rating DOUBLE PRECISION NOT NULL DEFAULT 1500,
  rating_deviation DOUBLE PRECISION NOT NULL DEFAULT 350,
  volatility DOUBLE PRECISION NOT NULL DEFAULT 0.06,
  matches_played INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- TOURNAMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'registration', 'group_stage', 'bracket_stage', 'finished')),
  hidden_standings BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tournaments_slug ON public.tournaments(slug);
CREATE INDEX IF NOT EXISTS idx_tournaments_status ON public.tournaments(status);

-- ============================================================
-- TOURNAMENT CONFIG
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tournament_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL UNIQUE REFERENCES public.tournaments(id) ON DELETE CASCADE,
  total_players INTEGER,
  group_count INTEGER CHECK (group_count IS NULL OR (group_count >= 1 AND group_count <= 4)),
  group_sizes INTEGER[],
  hidden_standings BOOLEAN NOT NULL DEFAULT true,
  group_target_points INTEGER NOT NULL DEFAULT 7,
  knockout_target_points INTEGER NOT NULL DEFAULT 11,
  final_target_points INTEGER NOT NULL DEFAULT 15,
  required_difference INTEGER NOT NULL DEFAULT 2,
  qualifiers_per_group INTEGER
);

-- ============================================================
-- TOURNAMENT GROUPS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tournament_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  group_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed')),
  expected_matches INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  UNIQUE(tournament_id, group_code)
);

CREATE INDEX IF NOT EXISTS idx_tournament_groups_tournament ON public.tournament_groups(tournament_id);

-- ============================================================
-- TOURNAMENT PARTICIPANTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tournament_participants (
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  group_id UUID REFERENCES public.tournament_groups(id),
  seed_number INTEGER,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tournament_id, user_id),
  UNIQUE(tournament_id, seed_number)
);

CREATE INDEX IF NOT EXISTS idx_participants_user ON public.tournament_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_participants_group ON public.tournament_participants(group_id);

-- ============================================================
-- MATCHES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  stage TEXT NOT NULL CHECK (stage IN ('group', 'round_of_16', 'quarterfinal', 'semifinal', 'final')),
  group_id UUID REFERENCES public.tournament_groups(id),
  bracket_match_id TEXT,
  player1_id UUID NOT NULL REFERENCES public.profiles(id),
  player2_id UUID NOT NULL REFERENCES public.profiles(id),
  score_player1 INTEGER,
  score_player2 INTEGER,
  winner_id UUID REFERENCES public.profiles(id),
  reported_by UUID REFERENCES public.profiles(id),
  confirmed_by UUID REFERENCES public.profiles(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'confirmed', 'disputed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ,
  CHECK (player1_id != player2_id)
);

CREATE INDEX IF NOT EXISTS idx_matches_tournament ON public.matches(tournament_id);
CREATE INDEX IF NOT EXISTS idx_matches_group ON public.matches(group_id);
CREATE INDEX IF NOT EXISTS idx_matches_players ON public.matches(player1_id, player2_id);
CREATE INDEX IF NOT EXISTS idx_matches_status ON public.matches(status);
CREATE INDEX IF NOT EXISTS idx_matches_stage ON public.matches(stage);
CREATE INDEX IF NOT EXISTS idx_matches_bracket ON public.matches(bracket_match_id);

-- ============================================================
-- MATCH REPORTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.match_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  reported_by UUID NOT NULL REFERENCES public.profiles(id),
  score_player1 INTEGER NOT NULL,
  score_player2 INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_match_reports_match ON public.match_reports(match_id);

-- ============================================================
-- AUDIT LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES public.profiles(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  previous_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);

-- ============================================================
-- HISTORICAL ARCHIVE TABLES
-- ============================================================

-- Canonical Player Identity
CREATE TABLE IF NOT EXISTS public.players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name TEXT NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_players_user ON public.players(user_id);
CREATE INDEX IF NOT EXISTS idx_players_canonical_name ON public.players(canonical_name);

-- Player Aliases
CREATE TABLE IF NOT EXISTS public.player_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  source_system TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(alias, source_system)
);

CREATE INDEX IF NOT EXISTS idx_player_aliases_alias ON public.player_aliases(alias);
CREATE INDEX IF NOT EXISTS idx_player_aliases_player ON public.player_aliases(player_id);

-- Historical Imports
CREATE TABLE IF NOT EXISTS public.historical_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name TEXT NOT NULL,
  import_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  imported_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  raw_payload JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed')),
  records_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Historical Tournaments
CREATE TABLE IF NOT EXISTS public.historical_tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id UUID REFERENCES public.historical_imports(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  year INTEGER NOT NULL,
  tournament_date DATE NOT NULL,
  location TEXT,
  format_details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hist_tournaments_year ON public.historical_tournaments(year);
CREATE INDEX IF NOT EXISTS idx_hist_tournaments_slug ON public.historical_tournaments(slug);

-- Historical Groups
CREATE TABLE IF NOT EXISTS public.historical_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  historical_tournament_id UUID NOT NULL REFERENCES public.historical_tournaments(id) ON DELETE CASCADE,
  group_code TEXT NOT NULL,
  expected_matches INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(historical_tournament_id, group_code)
);

-- Historical Matches
CREATE TABLE IF NOT EXISTS public.historical_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  historical_tournament_id UUID NOT NULL REFERENCES public.historical_tournaments(id) ON DELETE CASCADE,
  historical_group_id UUID REFERENCES public.historical_groups(id) ON DELETE SET NULL,
  stage TEXT NOT NULL,
  player1_id UUID NOT NULL REFERENCES public.players(id),
  player2_id UUID NOT NULL REFERENCES public.players(id),
  score_player1 INTEGER NOT NULL,
  score_player2 INTEGER NOT NULL,
  winner_id UUID REFERENCES public.players(id),
  status TEXT NOT NULL DEFAULT 'complete',
  match_date TIMESTAMPTZ,
  source_record JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hist_matches_tourney ON public.historical_matches(historical_tournament_id);
CREATE INDEX IF NOT EXISTS idx_hist_matches_players ON public.historical_matches(player1_id, player2_id);

-- Current Rating States
CREATE TABLE IF NOT EXISTS public.rating_states (
  player_id UUID PRIMARY KEY REFERENCES public.players(id) ON DELETE CASCADE,
  rating DOUBLE PRECISION NOT NULL DEFAULT 1500,
  rating_deviation DOUBLE PRECISION NOT NULL DEFAULT 350,
  volatility DOUBLE PRECISION NOT NULL DEFAULT 0.06,
  matches_played INTEGER NOT NULL DEFAULT 0,
  last_calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rating Snapshots (Point in time)
CREATE TABLE IF NOT EXISTS public.rating_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  rating_period_id TEXT NOT NULL,
  period_type TEXT NOT NULL CHECK (period_type IN ('historical_tournament', 'live_tournament', 'manual_adjustment')),
  rating_before DOUBLE PRECISION NOT NULL,
  rd_before DOUBLE PRECISION NOT NULL,
  vol_before DOUBLE PRECISION NOT NULL,
  rating_after DOUBLE PRECISION NOT NULL,
  rd_after DOUBLE PRECISION NOT NULL,
  vol_after DOUBLE PRECISION NOT NULL,
  matches_in_period INTEGER NOT NULL DEFAULT 0,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rating_snapshots_player ON public.rating_snapshots(player_id);
CREATE INDEX IF NOT EXISTS idx_rating_snapshots_period ON public.rating_snapshots(rating_period_id);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_profiles ON public.profiles;
CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_tournaments ON public.tournaments;
CREATE TRIGGER set_updated_at_tournaments
  BEFORE UPDATE ON public.tournaments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_matches ON public.matches;
CREATE TRIGGER set_updated_at_matches
  BEFORE UPDATE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_players ON public.players;
CREATE TRIGGER set_updated_at_players
  BEFORE UPDATE ON public.players
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- HELPER FUNCTIONS & RPCs
-- ============================================================

-- Helper: check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
    AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Atomic Match Confirmation RPC
CREATE OR REPLACE FUNCTION public.confirm_match(
  p_match_id UUID,
  p_confirming_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_match RECORD;
  v_winner_id UUID;
BEGIN
  -- 1. Lock match record FOR UPDATE to prevent race conditions
  SELECT * INTO v_match
  FROM public.matches
  WHERE id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match not found');
  END IF;

  -- 2. Verify status
  IF v_match.status != 'submitted' THEN
    IF v_match.status = 'confirmed' THEN
      RETURN jsonb_build_object('success', true, 'message', 'Match already confirmed');
    END IF;
    RETURN jsonb_build_object('success', false, 'error', 'Match is not in submitted state');
  END IF;

  -- 3. Verify that confirming user is the opponent of the reporter
  IF v_match.reported_by = p_confirming_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reporter cannot confirm their own report');
  END IF;

  IF v_match.player1_id != p_confirming_user_id AND v_match.player2_id != p_confirming_user_id THEN
    -- Admin override allowed
    IF NOT public.is_admin() THEN
      RETURN jsonb_build_object('success', false, 'error', 'Not authorized to confirm this match');
    END IF;
  END IF;

  -- 4. Determine winner
  IF v_match.score_player1 > v_match.score_player2 THEN
    v_winner_id := v_match.player1_id;
  ELSE
    v_winner_id := v_match.player2_id;
  END IF;

  -- 5. Update match
  UPDATE public.matches
  SET
    status = 'confirmed',
    winner_id = v_winner_id,
    confirmed_by = p_confirming_user_id,
    confirmed_at = now(),
    updated_at = now()
  WHERE id = p_match_id;

  -- 6. Insert audit log
  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, previous_data, new_data)
  VALUES (
    p_confirming_user_id,
    'confirm_match',
    'matches',
    p_match_id::TEXT,
    jsonb_build_object('status', v_match.status),
    jsonb_build_object('status', 'confirmed', 'winner_id', v_winner_id)
  );

  RETURN jsonb_build_object(
    'success', true,
    'match_id', p_match_id,
    'winner_id', v_winner_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- ROW LEVEL SECURITY
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

-- PROFILES
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "profiles_admin_update" ON public.profiles;
CREATE POLICY "profiles_admin_update" ON public.profiles FOR UPDATE USING (public.is_admin());

-- TOURNAMENTS
DROP POLICY IF EXISTS "tournaments_select_all" ON public.tournaments;
CREATE POLICY "tournaments_select_all" ON public.tournaments FOR SELECT USING (true);

DROP POLICY IF EXISTS "tournaments_admin_insert" ON public.tournaments;
CREATE POLICY "tournaments_admin_insert" ON public.tournaments FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "tournaments_admin_update" ON public.tournaments;
CREATE POLICY "tournaments_admin_update" ON public.tournaments FOR UPDATE USING (public.is_admin());

-- TOURNAMENT CONFIG
DROP POLICY IF EXISTS "tournament_config_select" ON public.tournament_config;
CREATE POLICY "tournament_config_select" ON public.tournament_config FOR SELECT USING (true);

DROP POLICY IF EXISTS "tournament_config_admin_insert" ON public.tournament_config;
CREATE POLICY "tournament_config_admin_insert" ON public.tournament_config FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "tournament_config_admin_update" ON public.tournament_config;
CREATE POLICY "tournament_config_admin_update" ON public.tournament_config FOR UPDATE USING (public.is_admin());

-- TOURNAMENT GROUPS
DROP POLICY IF EXISTS "tournament_groups_select" ON public.tournament_groups;
CREATE POLICY "tournament_groups_select" ON public.tournament_groups FOR SELECT USING (true);

DROP POLICY IF EXISTS "tournament_groups_admin_insert" ON public.tournament_groups;
CREATE POLICY "tournament_groups_admin_insert" ON public.tournament_groups FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "tournament_groups_admin_update" ON public.tournament_groups;
CREATE POLICY "tournament_groups_admin_update" ON public.tournament_groups FOR UPDATE USING (public.is_admin());

-- TOURNAMENT PARTICIPANTS
DROP POLICY IF EXISTS "participants_select" ON public.tournament_participants;
CREATE POLICY "participants_select" ON public.tournament_participants FOR SELECT USING (true);

DROP POLICY IF EXISTS "participants_self_insert" ON public.tournament_participants;
CREATE POLICY "participants_self_insert" ON public.tournament_participants FOR INSERT WITH CHECK (
  (SELECT auth.uid()) = user_id
  AND EXISTS (SELECT 1 FROM public.tournaments WHERE id = tournament_id AND status = 'registration')
);

DROP POLICY IF EXISTS "participants_admin_insert" ON public.tournament_participants;
CREATE POLICY "participants_admin_insert" ON public.tournament_participants FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "participants_admin_update" ON public.tournament_participants;
CREATE POLICY "participants_admin_update" ON public.tournament_participants FOR UPDATE USING (public.is_admin());

-- MATCHES
DROP POLICY IF EXISTS "matches_select" ON public.matches;
CREATE POLICY "matches_select" ON public.matches FOR SELECT USING (true);

DROP POLICY IF EXISTS "matches_admin_insert" ON public.matches;
CREATE POLICY "matches_admin_insert" ON public.matches FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "matches_player_update" ON public.matches;
CREATE POLICY "matches_player_update" ON public.matches FOR UPDATE USING (
  (SELECT auth.uid()) = player1_id OR (SELECT auth.uid()) = player2_id OR public.is_admin()
);

-- MATCH REPORTS
DROP POLICY IF EXISTS "match_reports_select" ON public.match_reports;
CREATE POLICY "match_reports_select" ON public.match_reports FOR SELECT USING (true);

DROP POLICY IF EXISTS "match_reports_player_insert" ON public.match_reports;
CREATE POLICY "match_reports_player_insert" ON public.match_reports FOR INSERT WITH CHECK (
  (SELECT auth.uid()) = reported_by
);

-- AUDIT LOGS
DROP POLICY IF EXISTS "audit_logs_admin_select" ON public.audit_logs;
CREATE POLICY "audit_logs_admin_select" ON public.audit_logs FOR SELECT USING (public.is_admin());

-- HISTORICAL ARCHIVE POLICIES
DROP POLICY IF EXISTS "players_select_all" ON public.players;
CREATE POLICY "players_select_all" ON public.players FOR SELECT USING (true);

DROP POLICY IF EXISTS "players_admin_write" ON public.players;
CREATE POLICY "players_admin_write" ON public.players FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "player_aliases_select_all" ON public.player_aliases;
CREATE POLICY "player_aliases_select_all" ON public.player_aliases FOR SELECT USING (true);

DROP POLICY IF EXISTS "player_aliases_admin_write" ON public.player_aliases;
CREATE POLICY "player_aliases_admin_write" ON public.player_aliases FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "historical_tournaments_select_all" ON public.historical_tournaments;
CREATE POLICY "historical_tournaments_select_all" ON public.historical_tournaments FOR SELECT USING (true);

DROP POLICY IF EXISTS "historical_tournaments_admin_write" ON public.historical_tournaments;
CREATE POLICY "historical_tournaments_admin_write" ON public.historical_tournaments FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "historical_groups_select_all" ON public.historical_groups;
CREATE POLICY "historical_groups_select_all" ON public.historical_groups FOR SELECT USING (true);

DROP POLICY IF EXISTS "historical_groups_admin_write" ON public.historical_groups;
CREATE POLICY "historical_groups_admin_write" ON public.historical_groups FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "historical_matches_select_all" ON public.historical_matches;
CREATE POLICY "historical_matches_select_all" ON public.historical_matches FOR SELECT USING (true);

DROP POLICY IF EXISTS "historical_matches_admin_write" ON public.historical_matches;
CREATE POLICY "historical_matches_admin_write" ON public.historical_matches FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "rating_states_select_all" ON public.rating_states;
CREATE POLICY "rating_states_select_all" ON public.rating_states FOR SELECT USING (true);

DROP POLICY IF EXISTS "rating_states_admin_write" ON public.rating_states;
CREATE POLICY "rating_states_admin_write" ON public.rating_states FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "rating_snapshots_select_all" ON public.rating_snapshots;
CREATE POLICY "rating_snapshots_select_all" ON public.rating_snapshots FOR SELECT USING (true);

DROP POLICY IF EXISTS "rating_snapshots_admin_write" ON public.rating_snapshots;
CREATE POLICY "rating_snapshots_admin_write" ON public.rating_snapshots FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "historical_imports_admin_all" ON public.historical_imports;
CREATE POLICY "historical_imports_admin_all" ON public.historical_imports FOR ALL USING (public.is_admin());

-- ============================================================
-- REALTIME
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_groups;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tournaments;

ALTER TABLE public.matches REPLICA IDENTITY FULL;
ALTER TABLE public.tournament_participants REPLICA IDENTITY FULL;
ALTER TABLE public.tournament_groups REPLICA IDENTITY FULL;
ALTER TABLE public.tournaments REPLICA IDENTITY FULL;
