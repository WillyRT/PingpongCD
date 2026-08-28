-- Migration 002: Allow nullable winner_id for missing/unplayed historical matches and add status column
ALTER TABLE public.historical_matches ALTER COLUMN winner_id DROP NOT NULL;
ALTER TABLE public.historical_matches ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'complete';
