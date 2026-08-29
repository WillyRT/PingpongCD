-- ==============================================================================
-- Migration 006: Secure confirm_match RPC & Enforce 5-State Tournament Enum
-- ==============================================================================

-- 1. Drop the vulnerable 2-parameter signature of confirm_match if exists
DROP FUNCTION IF EXISTS public.confirm_match(UUID, UUID);

-- 2. Define the secured 1-parameter confirm_match deriving identity from auth.uid()
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

  -- Enforce authorization if invoked by an authenticated user
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

-- 3. Restrict execution permissions: REVOKE from public/anon/authenticated and GRANT to service_role
REVOKE ALL ON FUNCTION public.confirm_match(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_match(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.confirm_match(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_match(UUID) TO service_role;

-- 4. Re-enforce the 5 canonical tournament states: draft, registration, group_stage, bracket_stage, finished
ALTER TABLE public.tournaments DROP CONSTRAINT IF EXISTS tournaments_status_check;
ALTER TABLE public.tournaments ADD CONSTRAINT tournaments_status_check
  CHECK (status IN ('draft', 'registration', 'group_stage', 'bracket_stage', 'finished'));
