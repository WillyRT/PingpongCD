import { describe, it, expect } from 'vitest';
import type { MatchStatus } from '../../lib/engine/constants';

interface MockMatch {
  id: string;
  player1_id: string;
  player2_id: string;
  score_player1: number | null;
  score_player2: number | null;
  reported_by_id: string | null;
  verified_by_id: string | null;
  status: MatchStatus;
  dispute_reason: string | null;
}

/**
 * Pure authorization and transition logic replicating verifyMatchScoreAction
 */
function verifyMatchAuthorization(
  match: MockMatch,
  callerId: string,
  action: 'confirm' | 'dispute',
  callerRole: 'player' | 'referee' | 'admin' | 'super_admin',
  disputeReason?: string,
  overrides?: { score1: number; score2: number }
): { success: boolean; error?: string; status?: number } {
  const isPrivileged = callerRole === 'referee' || callerRole === 'admin' || callerRole === 'super_admin';
  const isParticipant = match.player1_id === callerId || match.player2_id === callerId;
  const isOpponent = isParticipant && callerId !== match.reported_by_id;

  if (!isPrivileged && !isParticipant) {
    return {
      success: false,
      status: 403,
      error: '403 Forbidden: No autorizado para confirmar o impugnar este partido.',
    };
  }

  if (action === 'confirm') {
    if (!isPrivileged && !isOpponent) {
      return {
        success: false,
        status: 403,
        error: '403 Forbidden: El jugador que reportó no puede auto-confirmar su propio resultado.',
      };
    }

    if (overrides) {
      match.score_player1 = overrides.score1;
      match.score_player2 = overrides.score2;
    }
    match.status = 'completed';
    match.verified_by_id = callerId;
    return { success: true };
  }

  if (action === 'dispute') {
    if (!isPrivileged && !isOpponent) {
      return {
        success: false,
        status: 403,
        error: '403 Forbidden: No puedes impugnar un marcador anotado por ti mismo.',
      };
    }

    match.status = 'disputed';
    match.dispute_reason = disputeReason || 'Marcador impugnado';
    return { success: true };
  }

  return { success: false, error: 'Acción no válida' };
}

describe('Tests Negativos Obligatorios: Match Dual Verification Suite', () => {
  const createBaseMatch = (): MockMatch => ({
    id: 'match-101',
    player1_id: 'player-1',
    player2_id: 'player-2',
    score_player1: 7,
    score_player2: 4,
    reported_by_id: 'player-1',
    verified_by_id: null,
    status: 'pending_verification',
    dispute_reason: null,
  });

  it('Test 1: Un jugador ajeno al partido (player3) recibe error 403 al intentar confirmar', () => {
    const match = createBaseMatch();
    const result = verifyMatchAuthorization(match, 'player-3', 'confirm', 'player');

    expect(result.success).toBe(false);
    expect(result.status).toBe(403);
    expect(result.error).toContain('403 Forbidden: No autorizado');
    expect(match.status).toBe('pending_verification');
  });

  it('Test 2: Un jugador ajeno al partido (player3) recibe error 403 al intentar impugnar', () => {
    const match = createBaseMatch();
    const result = verifyMatchAuthorization(
      match,
      'player-3',
      'dispute',
      'player',
      'Intento malicioso'
    );

    expect(result.success).toBe(false);
    expect(result.status).toBe(403);
    expect(result.error).toContain('403 Forbidden: No autorizado');
    expect(match.status).toBe('pending_verification');
  });

  it('Test 3: El jugador que reportó recibe error 403 si intenta auto-confirmarse', () => {
    const match = createBaseMatch();
    // player-1 is the reporter trying to confirm their own report
    const result = verifyMatchAuthorization(match, 'player-1', 'confirm', 'player');

    expect(result.success).toBe(false);
    expect(result.status).toBe(403);
    expect(result.error).toContain('403 Forbidden: El jugador que reportó no puede auto-confirmar');
    expect(match.status).toBe('pending_verification');
    expect(match.verified_by_id).toBeNull();
  });

  it('Test 4: El contrincante directo (player2) sí puede confirmar e impugnar con éxito', () => {
    // 4a. Confirmación exitosa
    const matchToConfirm = createBaseMatch();
    const confirmResult = verifyMatchAuthorization(
      matchToConfirm,
      'player-2',
      'confirm',
      'player'
    );

    expect(confirmResult.success).toBe(true);
    expect(matchToConfirm.status).toBe('completed');
    expect(matchToConfirm.verified_by_id).toBe('player-2');

    // 4b. Impugnación exitosa
    const matchToDispute = createBaseMatch();
    const disputeResult = verifyMatchAuthorization(
      matchToDispute,
      'player-2',
      'dispute',
      'player',
      'El marcador real fue 7-5 a mi favor.'
    );

    expect(disputeResult.success).toBe(true);
    expect(matchToDispute.status).toBe('disputed');
    expect(matchToDispute.dispute_reason).toBe('El marcador real fue 7-5 a mi favor.');
  });

  it('Test 5: Un referee o admin puede confirmar/override en cualquier partido', () => {
    const match = createBaseMatch();

    // Árbitro interviene y corrige el tanteo
    const refereeResult = verifyMatchAuthorization(
      match,
      'referee-arbitro-principal',
      'confirm',
      'referee',
      undefined,
      { score1: 5, score2: 7 }
    );

    expect(refereeResult.success).toBe(true);
    expect(match.status).toBe('completed');
    expect(match.score_player1).toBe(5);
    expect(match.score_player2).toBe(7);
    expect(match.verified_by_id).toBe('referee-arbitro-principal');
  });

  it('Test 6: Superadmin override pasa el partido a confirmed inmediatamente sin esperar al rival', () => {
    const match = createBaseMatch();
    match.status = 'reported';

    const adminResult = verifyMatchAuthorization(
      match,
      'super-admin-guillermo',
      'confirm',
      'super_admin'
    );

    expect(adminResult.success).toBe(true);
    expect(match.status).toBe('completed');
    expect(match.verified_by_id).toBe('super-admin-guillermo');
  });

  it('Test 7: Las Server Actions oficiales confirmMatchScoreAction y disputeMatchScoreAction están exportadas', async () => {
    const matchesModule = await import('../../lib/actions/matches');
    expect(typeof matchesModule.confirmMatchScoreAction).toBe('function');
    expect(typeof matchesModule.disputeMatchScoreAction).toBe('function');
    expect(typeof matchesModule.verifyMatchScoreAction).toBe('function');
    expect(typeof matchesModule.reportMatchScoreAction).toBe('function');
  });
});
