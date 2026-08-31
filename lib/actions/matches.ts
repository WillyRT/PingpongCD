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

/** Helper to check if caller has referee, admin or super_admin permissions */
async function checkRefereeOrAdmin(userId?: string | null): Promise<boolean> {
  if (!userId) return false;
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('role, admin_status, email')
    .eq('id', userId)
    .maybeSingle();

  if (!profile) return false;

  if (profile.email?.toLowerCase() === 'guillermoriveraterriza@gmail.com') return true;
  if (profile.role === 'super_admin' || profile.role === 'referee') return true;
  if (profile.role === 'admin' && profile.admin_status === 'approved') return true;

  return false;
}

/**
 * Report match score (Dual-Check initial submission):
 * - If caller is player1 or player2: saves provisional score, marks status = 'pending_verification' (or 'submitted') and sets reported_by_id.
 * - If caller is referee/admin/super_admin: directly confirms status = 'completed' (or 'confirmed') and verified_by_id = callerId.
 */
export async function reportMatchScoreAction(input: {
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
    if (!callerId) return { success: false, error: 'Acceso no autorizado: Se requiere sesión activa' };

    // Fetch match
    const { data: match, error: mError } = await admin
      .from('matches')
      .select('*')
      .eq('id', parsed.matchId)
      .single();

    if (mError || !match) return { success: false, error: 'Partido no encontrado' };

    if (match.status === 'confirmed' || match.status === 'completed') {
      return { success: false, error: 'El partido ya ha sido completado y verificado.' };
    }

    const isPrivileged = await checkRefereeOrAdmin(callerId);
    const isParticipant = match.player1_id === callerId || match.player2_id === callerId;

    if (!isPrivileged && !isParticipant) {
      return { success: false, error: '403 Forbidden: Solo los participantes del partido o un árbitro pueden anotar el tanteo.' };
    }

    // Validate score according to table tennis rules for this stage
    const validation = validateScoreForStage(
      parsed.scorePlayer1,
      parsed.scorePlayer2,
      match.stage as any
    );

    if (!validation.valid) {
      return { success: false, error: validation.reason || 'Puntuación no válida' };
    }

    // If caller is referee/admin, execute immediate completion
    if (isPrivileged) {
      return await finalizeAndConfirmMatch(admin, match, parsed.scorePlayer1, parsed.scorePlayer2, callerId, true);
    }

    // Otherwise, player report -> save provisional pending_verification / submitted
    await admin.from('match_reports').insert({
      match_id: parsed.matchId,
      reported_by: callerId,
      score_player1: parsed.scorePlayer1,
      score_player2: parsed.scorePlayer2,
    });

    await admin
      .from('matches')
      .update({
        score_player1: parsed.scorePlayer1,
        score_player2: parsed.scorePlayer2,
        reported_by: callerId,
        reported_by_id: callerId,
        status: 'pending_verification',
        updated_at: new Date().toISOString(),
      })
      .eq('id', parsed.matchId);

    await admin.from('audit_logs').insert({
      actor_id: callerId,
      action: 'report_score',
      entity_type: 'matches',
      entity_id: parsed.matchId,
      previous_data: { status: match.status },
      new_data: {
        status: 'pending_verification',
        score_player1: parsed.scorePlayer1,
        score_player2: parsed.scorePlayer2,
        reported_by_id: callerId,
      },
    });

    revalidatePath('/player');
    revalidatePath('/me');
    revalidatePath(`/player/report/${parsed.matchId}`);
    revalidatePath(`/admin/tournaments/${match.tournament_id}`);
    revalidatePath(`/admin/tournaments/${match.tournament_id}/stations`);
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Error al reportar marcador' };
  }
}

/** Backward compatible alias for reportMatchScoreAction */
export const reportScoreAction = reportMatchScoreAction;

/**
 * Verify match score action (Dual-Check second step / Referee mediation):
 * - 'confirm': Valid if caller is the opponent or a referee/admin. Marks match completed and recalculates ratings.
 * - 'dispute': Valid if caller is the opponent. Marks match disputed with disputeReason.
 */
export async function verifyMatchScoreAction(input: {
  matchId: string;
  action: 'confirm' | 'dispute';
  disputeReason?: string;
  disputeEvidenceUrl?: string;
  overrideScore1?: number;
  overrideScore2?: number;
}): Promise<ActionResponse> {
  try {
    const admin = createAdminClient();
    const userClient = await createClient();
    const { data: { user } } = await userClient.auth.getUser();
    const playerSession = await getPlayerSession();

    const callerId = user?.id || playerSession?.playerId;
    if (!callerId) return { success: false, error: 'Acceso no autorizado: Se requiere sesión activa' };

    const { data: match, error: mError } = await admin
      .from('matches')
      .select('*')
      .eq('id', input.matchId)
      .single();

    if (mError || !match) return { success: false, error: 'Partido no encontrado' };

    if (match.status === 'confirmed' || match.status === 'completed') {
      return { success: true }; // Idempotent
    }

    const isPrivileged = await checkRefereeOrAdmin(callerId);
    const isParticipant = match.player1_id === callerId || match.player2_id === callerId;
    const reportedById = match.reported_by_id || match.reported_by;
    const isOpponent = isParticipant && callerId !== reportedById;

    if (!isPrivileged && !isParticipant) {
      return { success: false, error: '403 Forbidden: No autorizado para confirmar o impugnar este partido.' };
    }

    if (input.action === 'confirm') {
      // Prevent self-confirmation unless referee/admin
      if (!isPrivileged && !isOpponent) {
        return { success: false, error: '403 Forbidden: El mismo jugador que registró el marcador no puede confirmarlo.' };
      }

      // If referee provides overrides
      const finalScore1 = input.overrideScore1 ?? match.score_player1;
      const finalScore2 = input.overrideScore2 ?? match.score_player2;

      if (finalScore1 === null || finalScore2 === null) {
        return { success: false, error: 'No hay puntuaciones registradas para confirmar' };
      }

      return await finalizeAndConfirmMatch(admin, match, finalScore1, finalScore2, callerId, isPrivileged);
    }

    if (input.action === 'dispute') {
      // Must be opponent or privileged referee/admin
      if (!isPrivileged && !isOpponent) {
        return { success: false, error: '403 Forbidden: No puedes impugnar un marcador anotado por ti mismo.' };
      }

      const reason = input.disputeReason?.trim() || 'Marcador impugnado por desacuerdo en el tanteo.';
      const evidenceUrl = input.disputeEvidenceUrl?.trim() || null;

      await admin
        .from('matches')
        .update({
          status: 'disputed',
          dispute_reason: reason,
          dispute_evidence_url: evidenceUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.matchId);

      await admin.from('audit_logs').insert({
        actor_id: callerId,
        action: 'dispute_match',
        entity_type: 'matches',
        entity_id: input.matchId,
        previous_data: { status: match.status },
        new_data: { status: 'disputed', dispute_reason: reason, dispute_evidence_url: evidenceUrl },
      });

      revalidatePath('/player');
      revalidatePath('/me');
      revalidatePath(`/admin/tournaments/${match.tournament_id}`);
      revalidatePath(`/admin/tournaments/${match.tournament_id}/stations`);
      return { success: true };
    }

    return { success: false, error: 'Acción no reconocida' };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Error verificando partido' };
  }
}

/** Helper to finalize match, advance bracket, update Glicko-2 ratings and free table */
async function finalizeAndConfirmMatch(
  admin: any,
  match: any,
  score1: number,
  score2: number,
  verifierId: string,
  isPrivileged: boolean
): Promise<ActionResponse> {
  const winnerNumber = determineWinner(score1, score2);
  const winnerId = winnerNumber === 1 ? match.player1_id : match.player2_id;
  const loserId = winnerNumber === 1 ? match.player2_id : match.player1_id;

  // Fetch players to evaluate upset
  const { data: pWinner } = await admin.from('profiles').select('*').eq('id', winnerId).single();
  const { data: pLoser } = await admin.from('profiles').select('*').eq('id', loserId).single();

  const evalResult = evaluateExpectedScore(
    winnerNumber === 1 ? (pWinner?.rating ?? 1500) : (pLoser?.rating ?? 1500),
    winnerNumber === 1 ? (pLoser?.rating ?? 1500) : (pWinner?.rating ?? 1500),
    score1,
    score2
  );

  // 1. Confirm and complete match
  await admin
    .from('matches')
    .update({
      status: 'confirmed',
      score_player1: score1,
      score_player2: score2,
      winner_id: winnerId,
      is_upset: evalResult.isUpset,
      confirmed_by: verifierId,
      verified_by_id: verifierId,
      confirmed_at: new Date().toISOString(),
      dispute_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', match.id);

  // 2. Advance winner in bracket if knockout match
  if (match.next_match_id && match.next_slot) {
    const slotField = match.next_slot === 1 ? 'player1_id' : 'player2_id';
    await admin
      .from('matches')
      .update({ [slotField]: winnerId, updated_at: new Date().toISOString() })
      .eq('id', match.next_match_id);
  }

  // 3. Update Glicko-2 ratings
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
      const confirmed = groupMatches.filter((m: any) => m.status === 'confirmed' || m.status === 'completed').length;
      const pending = groupMatches.filter((m: any) => m.status === 'pending' || m.status === 'scheduled').length;
      const submitted = groupMatches.filter((m: any) => m.status === 'submitted' || m.status === 'pending_verification').length;
      const disputed = groupMatches.filter((m: any) => m.status === 'disputed').length;

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

  // 5. If final stage, complete tournament
  if (match.stage === 'final') {
    await admin
      .from('tournaments')
      .update({ status: 'finished' })
      .eq('id', match.tournament_id);
  }

  // 6. Audit log
  await admin.from('audit_logs').insert({
    actor_id: verifierId,
    action: isPrivileged ? 'referee_override_match' : 'confirm_match',
    entity_type: 'matches',
    entity_id: match.id,
    previous_data: { status: match.status },
    new_data: { status: 'completed', winner_id: winnerId, score_player1: score1, score_player2: score2 },
  });

  // Revalidate tournament public page
  if (match.tournament_id) {
    const { data: tourney } = await admin
      .from('tournaments')
      .select('slug')
      .eq('id', match.tournament_id)
      .maybeSingle();
    if (tourney?.slug) {
      revalidatePath(`/t/${tourney.slug}`);
    }
  }

  revalidatePath('/player');
  revalidatePath('/me');
  revalidatePath('/');
  revalidatePath(`/admin/tournaments/${match.tournament_id}`);
  revalidatePath(`/admin/tournaments/${match.tournament_id}/stations`);
  return { success: true };
}

/** Confirm match score action (calls verifyMatchScoreAction with 'confirm') */
export async function confirmMatchAction(matchId: string): Promise<ActionResponse> {
  return verifyMatchScoreAction({ matchId, action: 'confirm' });
}

/** Dispute match score action (calls verifyMatchScoreAction with 'dispute') */
export async function disputeMatchAction(
  matchId: string,
  notes?: string,
  disputeEvidenceUrl?: string
): Promise<ActionResponse> {
  return verifyMatchScoreAction({ matchId, action: 'dispute', disputeReason: notes, disputeEvidenceUrl });
}

/** Official Action Aliases for Dual-Check Verification */
export const confirmMatchScoreAction = confirmMatchAction;
export const disputeMatchScoreAction = disputeMatchAction;
