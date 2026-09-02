-- ==============================================================================
-- Migration 011: Align confirm_match RPC & RLS Policies with Canonical States
-- Canonical Match States: 'scheduled', 'in_progress', 'pending_verification', 'completed', 'disputed', 'walkover'
-- ==============================================================================

-- 1. Helper function to check if the current user is approved staff (referee, admin, or super_admin)
CREATE OR REPLACE FUNCTION public.is_referee_or_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE (user_id = auth.uid() OR id = auth.uid())
      AND (
        (role IN ('admin', 'super_admin') AND admin_status = 'approved')
        OR role = 'referee'
      )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 2. Align confirm_match RPC with canonical status 'completed'
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

  -- Canonical finalized states check
  IF v_match.status IN ('completed', 'walkover') THEN
    RETURN jsonb_build_object('success', true, 'message', 'Match already completed');
  END IF;

  -- Enforce authorization: participants, referees, or approved admins
  IF v_caller_id IS NOT NULL THEN
    IF v_caller_id <> v_match.player1_id AND v_caller_id <> v_match.player2_id THEN
      IF NOT public.is_referee_or_admin() THEN
        RETURN jsonb_build_object('success', false, 'error', 'Only match participants, referees, or admins can confirm');
      END IF;
    END IF;

    IF v_caller_id = v_match.reported_by AND NOT public.is_referee_or_admin() THEN
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

  -- Update to canonical status: 'completed'
  UPDATE public.matches SET
    score_player1 = v_report.score_player1,
    score_player2 = v_report.score_player2,
    winner_id = v_winner_id,
    status = 'completed',
    updated_at = now()
  WHERE id = p_match_id;

  UPDATE public.match_reports SET status = 'completed' WHERE id = v_report.id;

  -- Advance bracket winner if tournament is in bracket stage
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
      'score2', v_report.score_player2,
      'status', 'completed'
    )
  );

  RETURN jsonb_build_object('success', true, 'winner_id', v_winner_id, 'status', 'completed');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 3. Restrict execution permissions
REVOKE ALL ON FUNCTION public.confirm_match(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_match(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.confirm_match(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_match(UUID) TO service_role;

-- 4. Update RLS policies for matches allowing participants and staff
DROP POLICY IF EXISTS "matches_player_update" ON public.matches;
CREATE POLICY "matches_player_update" ON public.matches FOR UPDATE USING (
  (SELECT auth.uid()) = player1_id 
  OR (SELECT auth.uid()) = player2_id 
  OR public.is_referee_or_admin()
);

-- 5. Update RLS policies for match_reports allowing participants, reporters, and staff
DROP POLICY IF EXISTS "match_reports_player_insert" ON public.match_reports;
CREATE POLICY "match_reports_player_insert" ON public.match_reports FOR INSERT WITH CHECK (
  (SELECT auth.uid()) = reported_by
  OR (SELECT auth.uid()) IN (SELECT player1_id FROM public.matches WHERE id = match_id)
  OR (SELECT auth.uid()) IN (SELECT player2_id FROM public.matches WHERE id = match_id)
  OR public.is_referee_or_admin()
);

-- 6. Enforce canonical 6-state constraint on matches
ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_status_check;
ALTER TABLE public.matches ADD CONSTRAINT matches_status_check 
  CHECK (status IN (
    'scheduled',
    'in_progress',
    'pending_verification',
    'completed',
    'disputed',
    'walkover'
  ));
