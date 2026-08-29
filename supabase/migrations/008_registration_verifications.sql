-- ==============================================================================
-- Migration 008: Registration Verifications Table for Email Possession Verification
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.registration_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE,
  player_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reg_verif_lookup_idx ON public.registration_verifications(LOWER(email), tournament_id);

ALTER TABLE public.registration_verifications ENABLE ROW LEVEL SECURITY;

-- Deny public direct access; manage strictly via service_role / security definer
REVOKE ALL ON TABLE public.registration_verifications FROM anon, authenticated;
GRANT ALL ON TABLE public.registration_verifications TO service_role;
