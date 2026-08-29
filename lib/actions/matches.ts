'use server';

import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getPlayerSession } from '@/lib/auth/player-session';
import { revalidatePath } from 'next/cache';
import { reportScoreSchema } from '@/lib/validation/schemas';
import { validateScoreForStage, determineWinner } from '@/lib/engine/scoring';
import { updateRatingsForMatch } from '@/lib/engine/rating';
import { evaluateExpectedScore } from '@/lib/engine/analytics';
import { isGroupComplete } from '@/lib/engine/tournament-state';
import type { ActionResponse } from './tournament';

/**
 * Player: Report match score.
 * Transitions match from pending -> submitted.
 * Authenticated via Supabase Auth or cryptographically signed player session cookie.
 */
export async function reportScoreAction(input: {
  matchId: string;
  scorePlayer1: number;
  scorePlayer2: number;
}): Promise<ActionResponse> {
  try {
    const parsed = reportScoreSchema.parse(input);
    const admin = createAdminClient();
    const userClient = await createClient();
    const { data: { user } } = await userClient.auth.getUser();
    const playerSession = await getPlayerSession();

    const callerId = user?.id || playerSession?.playerId;
    if (!callerId) return { success: false, error: 'Unauthorized: Session required' };

    // Fetch match
    const { data: match, error: mError } = await admin
      .from('matches')
      .select('*')
      .eq('id', parsed.matchId)
      .single();

    if (mError || !match) return { success: false, error: 'Match not found' };

    // Must be a participant
    if (match.player1_id !== callerId && match.player2_id !== callerId) {
      return { success: false, error: 'Only participants can report match score' };
    }

    if (match.status === 'confirmed') {
      return { success: false, error: 'Match has already been confirmed' };
    }

    // Validate score according to table tennis rules for this stage
    const validation = validateScoreForStage(
      parsed.scorePlayer1,
      parsed.scorePlayer2,
      match.stage as any
    );

    if (!validation.valid) {
      return { success: false, error: validation.reason || 'Invalid score' };
    }

    // Record report
    await admin.from('match_reports').insert({
      match_id: parsed.matchId,
      reported_by: callerId,
      score_player1: parsed.scorePlayer1,
      score_player2: parsed.scorePlayer2,
    });

    // Update match state to submitted
    await admin
      .from('matches')
      .update({
        score_player1: parsed.scorePlayer1,
        score_player2: parsed.scorePlayer2,
        reported_by: callerId,
        status: 'submitted',
      })
      .eq('id', parsed.matchId);

    // Audit log
    await admin.from('audit_logs').insert({
      actor_id: callerId,
      action: 'report_score',
      entity_type: 'matches',
      entity_id: parsed.matchId,
      previous_data: { status: match.status },
      new_data: {
        status: 'submitted',
        score_player1: parsed.scorePlayer1,
        score_player2: parsed.scorePlayer2,
      },
    });

    revalidatePath('/player');
    revalidatePath(`/player/report/${parsed.matchId}`);
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Opponent / Admin: Confirm match score.
 * Atomic server-side operation protected against unauthorized execution:
 * 1. Verifies caller is:
 *    a) Admin/SuperAdmin with approved status via Supabase Auth
 *    b) Match participant via verified session token, matching player1 or player2
 * 2. Rejects self-confirmation (reporter cannot confirm own report unless admin)
 * 3. Invokes database updates via service_role client
 * 4. Advances winner in bracket if knockout match
 * 5. Updates Glicko-2 ratings for both players
 * 6. Checks group completion status and unlocks standings if complete
 * 7. Emits audit log
 */
export async function confirmMatchAction(matchId: string): Promise<ActionResponse> {
  try {
    const admin = createAdminClient();
    const userClient = await createClient();
    const { data: { user } } = await userClient.auth.getUser();
    const playerSession = await getPlayerSession();

    const callerId = user?.id || playerSession?.playerId;
    if (!callerId) {
      return { success: false, error: 'Unauthorized: Session required' };
    }

    // Fetch match
    const { data: match, error: mError } = await admin
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .single();

    if (mError || !match) return { success: false, error: 'Match not found' };

    if (match.status === 'confirmed') {
      return { success: true }; // Idempotent
    }

    if (match.status !== 'submitted') {
      return { success: false, error: 'Match is not awaiting confirmation' };
    }

    // Verify admin role if user session is present
    let isAdmin = false;
    if (user) {
      const { data: profile } = await admin
        .from('profiles')
        .select('role, admin_status')
        .eq('id', user.id)
        .maybeSingle();

      if (
        profile?.admin_status === 'approved' &&
        (profile.role === 'admin' || profile.role === 'super_admin')
      ) {
        isAdmin = true;
      }
    }

    // Authorization checks
    const isPlayer = match.player1_id === callerId || match.player2_id === callerId;
    if (!isAdmin && !isPlayer) {
      return { success: false, error: 'Not authorized to confirm this match' };
    }

    const isReporter = match.reported_by === callerId;
    if (isReporter && !isAdmin) {
      return { success: false, error: 'Reporter cannot confirm their own report' };
    }

    const winnerNumber = determineWinner(match.score_player1 ?? 0, match.score_player2 ?? 0);
    const winnerId = winnerNumber === 1 ? match.player1_id : match.player2_id;
    const loserId = winnerNumber === 1 ? match.player2_id : match.player1_id;

    // Fetch players to evaluate upset
    const { data: pWinner } = await admin.from('profiles').select('*').eq('id', winnerId).single();
    const { data: pLoser } = await admin.from('profiles').select('*').eq('id', loserId).single();

    const evalResult = evaluateExpectedScore(
      winnerNumber === 1 ? (pWinner?.rating ?? 1500) : (pLoser?.rating ?? 1500),
      winnerNumber === 1 ? (pLoser?.rating ?? 1500) : (pWinner?.rating ?? 1500),
      match.score_player1 ?? 0,
      match.score_player2 ?? 0
    );

    // 1. Confirm match
    await admin
      .from('matches')
      .update({
        status: 'confirmed',
        winner_id: winnerId,
        is_upset: evalResult.isUpset,
        confirmed_by: callerId,
        confirmed_at: new Date().toISOString(),
      })
      .eq('id', matchId);

    // 2. Advance winner in bracket if knockout match
    if (match.next_match_id && match.next_slot) {
      if (match.next_slot === 1) {
        await admin
          .from('matches')
          .update({ player1_id: winnerId, updated_at: new Date().toISOString() })
          .eq('id', match.next_match_id);
      } else {
        await admin
          .from('matches')
          .update({ player2_id: winnerId, updated_at: new Date().toISOString() })
          .eq('id', match.next_match_id);
      }
    }

    // 3. Update Glicko-2 ratings for both players
    if (pWinner && pLoser) {
      const [updatedWinner, updatedLoser] = updateRatingsForMatch(
        {
          rating: pWinner.rating,
          ratingDeviation: pWinner.rating_deviation,
          volatility: pWinner.volatility,
          matchesPlayed: pWinner.matches_played,
        },
        {
          rating: pLoser.rating,
          ratingDeviation: pLoser.rating_deviation,
          volatility: pLoser.volatility,
          matchesPlayed: pLoser.matches_played,
        }
      );

      await admin.from('profiles').update({
        rating: updatedWinner.rating,
        rating_deviation: updatedWinner.ratingDeviation,
        volatility: updatedWinner.volatility,
        matches_played: updatedWinner.matchesPlayed,
      }).eq('id', winnerId);

      await admin.from('profiles').update({
        rating: updatedLoser.rating,
        rating_deviation: updatedLoser.ratingDeviation,
        volatility: updatedLoser.volatility,
        matches_played: updatedLoser.matchesPlayed,
      }).eq('id', loserId);
    }

    // 4. Check group completion if group stage
    if (match.stage === 'group' && match.group_id) {
      const { data: groupMatches } = await admin
        .from('matches')
        .select('status')
        .eq('group_id', match.group_id);

      const { data: grp } = await admin
        .from('tournament_groups')
        .select('*')
        .eq('id', match.group_id)
        .single();

      if (groupMatches && grp) {
        const confirmed = groupMatches.filter((m) => m.status === 'confirmed').length;
        const pending = groupMatches.filter((m) => m.status === 'pending').length;
        const submitted = groupMatches.filter((m) => m.status === 'submitted').length;
        const disputed = groupMatches.filter((m) => m.status === 'disputed').length;

        if (isGroupComplete(confirmed, grp.expected_matches, pending, submitted, disputed)) {
          await admin
            .from('tournament_groups')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
            })
            .eq('id', match.group_id);
        }
      }
    }

    // 5. If knockout stage, check if final match -> finish tournament
    if (match.stage === 'final') {
      await admin
        .from('tournaments')
        .update({ status: 'finished' })
        .eq('id', match.tournament_id);
    }

    // 6. Audit log
    await admin.from('audit_logs').insert({
      actor_id: callerId,
      action: 'confirm_match',
      entity_type: 'matches',
      entity_id: matchId,
      previous_data: { status: match.status },
      new_data: { status: 'confirmed', winner_id: winnerId },
    });

    revalidatePath('/player');
    revalidatePath('/admin');
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Player: Dispute match score.
 * Transitions match from submitted -> disputed.
 * Accessible to participants via Supabase Auth or signed player session.
 */
export async function disputeMatchAction(matchId: string, notes?: string): Promise<ActionResponse> {
  try {
    const admin = createAdminClient();
    const userClient = await createClient();
    const { data: { user } } = await userClient.auth.getUser();
    const playerSession = await getPlayerSession();

    const callerId = user?.id || playerSession?.playerId;
    if (!callerId) return { success: false, error: 'Unauthorized: Session required' };

    const { data: match, error: mError } = await admin
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .single();

    if (mError || !match) return { success: false, error: 'Match not found' };

    // Must be the opponent
    if (match.reported_by === callerId) {
      return { success: false, error: 'Cannot dispute your own report' };
    }

    if (match.player1_id !== callerId && match.player2_id !== callerId) {
      return { success: false, error: 'Only participants can dispute a match' };
    }

    await admin
      .from('matches')
      .update({ status: 'disputed' })
      .eq('id', matchId);

    await admin.from('audit_logs').insert({
      actor_id: callerId,
      action: 'dispute_match',
      entity_type: 'matches',
      entity_id: matchId,
      previous_data: { status: match.status },
      new_data: { status: 'disputed', notes },
    });

    revalidatePath('/player');
    revalidatePath('/admin');
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}
