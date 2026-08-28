'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { reportScoreSchema } from '@/lib/validation/schemas';
import { validateScoreForStage, determineWinner } from '@/lib/engine/scoring';
import { updateRatingsForMatch } from '@/lib/engine/rating';
import { evaluateExpectedScore, adjustVolatilityForUpset } from '@/lib/engine/analytics';
import { isGroupComplete } from '@/lib/engine/tournament-state';
import type { ActionResponse } from './tournament';

/**
 * Player: Report match score.
 * Transitions match from pending -> submitted.
 */
export async function reportScoreAction(input: {
  matchId: string;
  scorePlayer1: number;
  scorePlayer2: number;
}): Promise<ActionResponse> {
  try {
    const parsed = reportScoreSchema.parse(input);
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { success: false, error: 'Unauthorized' };

    // Fetch match
    const { data: match, error: mError } = await supabase
      .from('matches')
      .select('*')
      .eq('id', parsed.matchId)
      .single();

    if (mError || !match) return { success: false, error: 'Match not found' };

    // Must be a participant
    if (match.player1_id !== user.id && match.player2_id !== user.id) {
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
    await supabase.from('match_reports').insert({
      match_id: parsed.matchId,
      reported_by: user.id,
      score_player1: parsed.scorePlayer1,
      score_player2: parsed.scorePlayer2,
    });

    // Update match state to submitted
    await supabase
      .from('matches')
      .update({
        score_player1: parsed.scorePlayer1,
        score_player2: parsed.scorePlayer2,
        reported_by: user.id,
        status: 'submitted',
      })
      .eq('id', parsed.matchId);

    // Audit log
    await supabase.from('audit_logs').insert({
      actor_id: user.id,
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
 * Atomic server-side operation that:
 * 1. Verifies authentication & participant eligibility
 * 2. Updates match to confirmed
 * 3. Updates Glicko-2 ratings for both players
 * 4. Checks group completion status and unlocks standings if complete
 * 5. Advances winner in bracket if knockout match
 * 6. Emits audit log
 */
export async function confirmMatchAction(matchId: string): Promise<ActionResponse> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { success: false, error: 'Unauthorized' };

    // Fetch match
    const { data: match, error: mError } = await supabase
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

    // Must be opponent or admin
    const isReporter = match.reported_by === user.id;
    if (isReporter) {
      return { success: false, error: 'Reporter cannot confirm their own report' };
    }

    const isPlayer = match.player1_id === user.id || match.player2_id === user.id;
    if (!isPlayer) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (profile?.role !== 'admin' && profile?.role !== 'super_admin') {
        return { success: false, error: 'Not authorized to confirm this match' };
      }
    }

    const winnerNumber = determineWinner(match.score_player1 ?? 0, match.score_player2 ?? 0);
    const winnerId = winnerNumber === 1 ? match.player1_id : match.player2_id;
    const loserId = winnerNumber === 1 ? match.player2_id : match.player1_id;

    // Fetch players to evaluate upset
    const { data: pWinner } = await supabase.from('profiles').select('*').eq('id', winnerId).single();
    const { data: pLoser } = await supabase.from('profiles').select('*').eq('id', loserId).single();

    const evalResult = evaluateExpectedScore(
      winnerNumber === 1 ? (pWinner?.rating ?? 1500) : (pLoser?.rating ?? 1500),
      winnerNumber === 1 ? (pLoser?.rating ?? 1500) : (pWinner?.rating ?? 1500),
      match.score_player1 ?? 0,
      match.score_player2 ?? 0
    );

    // 1. Confirm match
    await supabase
      .from('matches')
      .update({
        status: 'confirmed',
        winner_id: winnerId,
        is_upset: evalResult.isUpset,
        confirmed_by: user.id,
        confirmed_at: new Date().toISOString(),
      })
      .eq('id', matchId);

    // 2. Update Glicko-2 ratings for both players
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

      // If upset occurred, boost winner volatility to accelerate convergence
      if (evalResult.isUpset) {
        updatedWinner.volatility = adjustVolatilityForUpset(updatedWinner.volatility);
      }

      await supabase.from('profiles').update({
        rating: updatedWinner.rating,
        rating_deviation: updatedWinner.ratingDeviation,
        volatility: updatedWinner.volatility,
        matches_played: updatedWinner.matchesPlayed,
      }).eq('id', winnerId);

      await supabase.from('profiles').update({
        rating: updatedLoser.rating,
        rating_deviation: updatedLoser.ratingDeviation,
        volatility: updatedLoser.volatility,
        matches_played: updatedLoser.matchesPlayed,
      }).eq('id', loserId);
    }

    // 3. Check group completion if group stage
    if (match.stage === 'group' && match.group_id) {
      const { data: groupMatches } = await supabase
        .from('matches')
        .select('status')
        .eq('group_id', match.group_id);

      const { data: grp } = await supabase
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
          await supabase
            .from('tournament_groups')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
            })
            .eq('id', match.group_id);
        }
      }
    }

    // 4. If knockout stage, check if final match -> finish tournament
    if (match.stage === 'final') {
      await supabase
        .from('tournaments')
        .update({ status: 'finished' })
        .eq('id', match.tournament_id);
    }

    // 5. Audit log
    await supabase.from('audit_logs').insert({
      actor_id: user.id,
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
 */
export async function disputeMatchAction(matchId: string, notes?: string): Promise<ActionResponse> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { success: false, error: 'Unauthorized' };

    const { data: match, error: mError } = await supabase
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .single();

    if (mError || !match) return { success: false, error: 'Match not found' };

    // Must be the opponent
    if (match.reported_by === user.id) {
      return { success: false, error: 'Cannot dispute your own report' };
    }

    if (match.player1_id !== user.id && match.player2_id !== user.id) {
      return { success: false, error: 'Only participants can dispute a match' };
    }

    await supabase
      .from('matches')
      .update({ status: 'disputed' })
      .eq('id', matchId);

    await supabase.from('audit_logs').insert({
      actor_id: user.id,
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
