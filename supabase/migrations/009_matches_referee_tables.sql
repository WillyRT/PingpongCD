-- ==============================================================================
-- Migration 009: Referee Role and 4 Tables Match Dispatch
-- ==============================================================================

-- 1. Support 'referee' in profiles.role
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('super_admin', 'admin', 'referee', 'player'));

-- 2. Add 4-table dispatch and dual-verification fields to matches
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS table_number INTEGER DEFAULT NULL;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS reported_by_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS verified_by_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS dispute_reason TEXT DEFAULT NULL;

-- 3. Expand match status check
ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_status_check;
ALTER TABLE public.matches ADD CONSTRAINT matches_status_check 
  CHECK (status IN (
    'pending', 'submitted', 'confirmed', 'disputed',
    'scheduled', 'in_progress', 'pending_verification', 'completed', 'walkover'
  ));

-- 4. Create index on table_number and status for real-time station monitoring
CREATE INDEX IF NOT EXISTS matches_station_idx ON public.matches(tournament_id, table_number, status);
