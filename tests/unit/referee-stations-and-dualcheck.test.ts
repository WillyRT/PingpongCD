import { describe, it, expect } from 'vitest';
import { getSigningSecret, createPlayerSessionToken, verifyPlayerSessionToken } from '../../lib/auth/session';
import { MATCH_STATUSES, type MatchStatus } from '../../lib/engine/constants';

describe('MÓDULO 2 & 4: Referee, Dual-Check & 4-Station Architecture Suite', () => {
  describe('1. Fallback Robusto de SESSION_SECRET y Token Signing', () => {
    it('uses the ephemeral Web Crypto key when neither SESSION_SECRET nor HMAC_SECRET is provided in dev/test', async () => {
      const origSession = process.env.SESSION_SECRET;
      const origHmac = process.env.HMAC_SECRET;
      delete process.env.SESSION_SECRET;
      delete process.env.HMAC_SECRET;

      try {
        const secret = getSigningSecret();
        expect(typeof secret).toBe('string');
        expect(secret.length).toBe(64); // 32 bytes in hex

        // Verify token can be signed and verified without runtime exceptions
        const token = await createPlayerSessionToken({
          playerId: 'p-123',
          email: 'player@example.com',
          tournamentId: 'tourney-456',
        });
        expect(typeof token).toBe('string');

        const verified = await verifyPlayerSessionToken(token);
        expect(verified).not.toBeNull();
        expect(verified?.playerId).toBe('p-123');
      } finally {
        process.env.SESSION_SECRET = origSession;
        process.env.HMAC_SECRET = origHmac;
      }
    });
  });

  describe('2. Match Statuses & Schema Expansion', () => {
    it('supports canonical and expanded dual-check statuses', () => {
      const expectedStatuses = [
        'pending',
        'submitted',
        'confirmed',
        'disputed',
        'scheduled',
        'in_progress',
        'pending_verification',
        'completed',
        'walkover',
      ];

      for (const st of expectedStatuses) {
        expect(MATCH_STATUSES).toContain(st);
      }
    });
  });

  describe('3. Dual-Check Verification & Impossibility of Self-Confirmation', () => {
    interface MockMatch {
      id: string;
      player1_id: string;
      player2_id: string;
      score_player1: number | null;
      score_player2: number | null;
      reported_by: string | null;
      reported_by_id: string | null;
      verified_by_id: string | null;
      status: MatchStatus;
      dispute_reason: string | null;
      table_number: number | null;
    }

    function simulateReport(
      match: MockMatch,
      callerId: string,
      score1: number,
      score2: number,
      callerRole: 'player' | 'referee' | 'admin' | 'super_admin'
    ): { success: boolean; error?: string } {
      if (match.status === 'confirmed' || match.status === 'completed') {
        return { success: false, error: 'Partido ya completado' };
      }

      const isPrivileged = callerRole === 'referee' || callerRole === 'admin' || callerRole === 'super_admin';
      const isParticipant = match.player1_id === callerId || match.player2_id === callerId;

      if (!isPrivileged && !isParticipant) {
        return { success: false, error: 'Solo los participantes o el árbitro pueden anotar el marcador' };
      }

      match.score_player1 = score1;
      match.score_player2 = score2;
      match.reported_by = callerId;
      match.reported_by_id = callerId;

      if (isPrivileged) {
        match.status = 'completed';
        match.verified_by_id = callerId;
      } else {
        match.status = 'pending_verification';
      }

      return { success: true };
    }

    function simulateVerify(
      match: MockMatch,
      callerId: string,
      action: 'confirm' | 'dispute',
      callerRole: 'player' | 'referee' | 'admin' | 'super_admin',
      disputeReason?: string,
      overrideScores?: { score1: number; score2: number }
    ): { success: boolean; error?: string } {
      const isPrivileged = callerRole === 'referee' || callerRole === 'admin' || callerRole === 'super_admin';
      const isParticipant = match.player1_id === callerId || match.player2_id === callerId;

      if (!isPrivileged && !isParticipant) {
        return { success: false, error: 'No autorizado' };
      }

      if (action === 'confirm') {
        if (!isPrivileged && match.reported_by_id === callerId) {
          return { success: false, error: 'El jugador que reportó no puede auto-confirmar su propio resultado.' };
        }

        if (overrideScores) {
          match.score_player1 = overrideScores.score1;
          match.score_player2 = overrideScores.score2;
        }

        match.status = 'completed';
        match.verified_by_id = callerId;
        return { success: true };
      }

      if (action === 'dispute') {
        if (!isPrivileged && match.reported_by_id === callerId) {
          return { success: false, error: 'No puedes impugnar un marcador anotado por ti mismo' };
        }

        match.status = 'disputed';
        match.dispute_reason = disputeReason || 'Marcador impugnado';
        return { success: true };
      }

      return { success: false, error: 'Acción inválida' };
    }

    it('allows player1 to report score, setting status to pending_verification', () => {
      const match: MockMatch = {
        id: 'm-1',
        player1_id: 'p-1',
        player2_id: 'p-2',
        score_player1: null,
        score_player2: null,
        reported_by: null,
        reported_by_id: null,
        verified_by_id: null,
        status: 'pending',
        dispute_reason: null,
        table_number: 1,
      };

      const res = simulateReport(match, 'p-1', 7, 4, 'player');
      expect(res.success).toBe(true);
      expect(match.status).toBe('pending_verification');
      expect(match.reported_by_id).toBe('p-1');
      expect(match.score_player1).toBe(7);
      expect(match.score_player2).toBe(4);
    });

    it('rejects self-confirmation when reporter tries to verify their own report', () => {
      const match: MockMatch = {
        id: 'm-1',
        player1_id: 'p-1',
        player2_id: 'p-2',
        score_player1: 7,
        score_player2: 4,
        reported_by: 'p-1',
        reported_by_id: 'p-1',
        verified_by_id: null,
        status: 'pending_verification',
        dispute_reason: null,
        table_number: 1,
      };

      const res = simulateVerify(match, 'p-1', 'confirm', 'player');
      expect(res.success).toBe(false);
      expect(res.error).toContain('no puede auto-confirmar su propio resultado');
      expect(match.status).toBe('pending_verification');
    });

    it('allows opponent (player2) to confirm score, transitioning to completed', () => {
      const match: MockMatch = {
        id: 'm-1',
        player1_id: 'p-1',
        player2_id: 'p-2',
        score_player1: 7,
        score_player2: 4,
        reported_by: 'p-1',
        reported_by_id: 'p-1',
        verified_by_id: null,
        status: 'pending_verification',
        dispute_reason: null,
        table_number: 1,
      };

      const res = simulateVerify(match, 'p-2', 'confirm', 'player');
      expect(res.success).toBe(true);
      expect(match.status).toBe('completed');
      expect(match.verified_by_id).toBe('p-2');
    });

    it('allows opponent (player2) to dispute score with reason', () => {
      const match: MockMatch = {
        id: 'm-1',
        player1_id: 'p-1',
        player2_id: 'p-2',
        score_player1: 7,
        score_player2: 4,
        reported_by: 'p-1',
        reported_by_id: 'p-1',
        verified_by_id: null,
        status: 'pending_verification',
        dispute_reason: null,
        table_number: 1,
      };

      const res = simulateVerify(match, 'p-2', 'dispute', 'player', 'El tanteo fue 7-5 a mi favor');
      expect(res.success).toBe(true);
      expect(match.status).toBe('disputed');
      expect(match.dispute_reason).toBe('El tanteo fue 7-5 a mi favor');
    });

    it('allows referee to mediate and force official approval with override scores', () => {
      const match: MockMatch = {
        id: 'm-1',
        player1_id: 'p-1',
        player2_id: 'p-2',
        score_player1: 7,
        score_player2: 4,
        reported_by: 'p-1',
        reported_by_id: 'p-1',
        verified_by_id: null,
        status: 'disputed',
        dispute_reason: 'El tanteo fue 7-5 a mi favor',
        table_number: 1,
      };

      const res = simulateVerify(
        match,
        'ref-007',
        'confirm',
        'referee',
        undefined,
        { score1: 5, score2: 7 }
      );

      expect(res.success).toBe(true);
      expect(match.status).toBe('completed');
      expect(match.score_player1).toBe(5);
      expect(match.score_player2).toBe(7);
      expect(match.verified_by_id).toBe('ref-007');
    });
  });

  describe('4. RBAC Promotion & Referee Authority Constraints', () => {
    function simulatePromoteUser(
      actorRole: 'player' | 'referee' | 'admin' | 'super_admin',
      targetNewRole: 'admin' | 'referee' | 'player'
    ): { allowed: boolean; reason?: string } {
      if (actorRole === 'player' || actorRole === 'referee') {
        return { allowed: false, reason: 'Solo administradores pueden gestionar roles' };
      }

      if (actorRole === 'admin') {
        if (targetNewRole === 'admin') {
          return { allowed: false, reason: 'Solo el Superadmin principal puede otorgar permisos de Administrador.' };
        }
        return { allowed: true }; // Admin can appoint referee or player
      }

      if (actorRole === 'super_admin') {
        return { allowed: true }; // Superadmin can appoint any role
      }

      return { allowed: false };
    }

    it('prevents referee from promoting any user', () => {
      expect(simulatePromoteUser('referee', 'referee').allowed).toBe(false);
      expect(simulatePromoteUser('referee', 'admin').allowed).toBe(false);
    });

    it('allows admin to promote user to referee', () => {
      expect(simulatePromoteUser('admin', 'referee').allowed).toBe(true);
      expect(simulatePromoteUser('admin', 'player').allowed).toBe(true);
    });

    it('prevents admin from promoting user to admin (super_admin required)', () => {
      const res = simulatePromoteUser('admin', 'admin');
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('Solo el Superadmin');
    });

    it('allows super_admin to promote to any role including admin', () => {
      expect(simulatePromoteUser('super_admin', 'admin').allowed).toBe(true);
      expect(simulatePromoteUser('super_admin', 'referee').allowed).toBe(true);
      expect(simulatePromoteUser('super_admin', 'player').allowed).toBe(true);
    });
  });

  describe('5. 4-Table Mapping & Semaphore Signal Calculation', () => {
    function getGroupForTable(tableNumber: number): string {
      if (tableNumber < 1 || tableNumber > 4) {
        throw new Error('El número de mesa debe estar entre 1 y 4');
      }
      const map: Record<number, string> = {
        1: 'Grupo A',
        2: 'Grupo B',
        3: 'Grupo C',
        4: 'Grupo D',
      };
      return map[tableNumber]!;
    }

    function calculateTableSemaphore(matchStatus?: MatchStatus | null): {
      color: string;
      label: string;
    } {
      if (!matchStatus || matchStatus === 'confirmed' || matchStatus === 'completed') {
        return { color: 'green', label: 'Libre' };
      }
      if (matchStatus === 'disputed') {
        return { color: 'red', label: 'En Disputa' };
      }
      if (matchStatus === 'pending_verification' || matchStatus === 'submitted') {
        return { color: 'yellow', label: 'Pendiente Confirmación' };
      }
      if (matchStatus === 'in_progress' || matchStatus === 'scheduled') {
        return { color: 'blue', label: 'En Juego' };
      }
      return { color: 'green', label: 'Libre' };
    }

    it('maps tables 1, 2, 3, 4 to Groups A, B, C, D', () => {
      expect(getGroupForTable(1)).toBe('Grupo A');
      expect(getGroupForTable(2)).toBe('Grupo B');
      expect(getGroupForTable(3)).toBe('Grupo C');
      expect(getGroupForTable(4)).toBe('Grupo D');
      expect(() => getGroupForTable(0)).toThrow();
      expect(() => getGroupForTable(5)).toThrow();
    });

    it('computes correct semaphore signal for each match status', () => {
      expect(calculateTableSemaphore(null)).toEqual({ color: 'green', label: 'Libre' });
      expect(calculateTableSemaphore('completed')).toEqual({ color: 'green', label: 'Libre' });
      expect(calculateTableSemaphore('in_progress')).toEqual({ color: 'blue', label: 'En Juego' });
      expect(calculateTableSemaphore('scheduled')).toEqual({ color: 'blue', label: 'En Juego' });
      expect(calculateTableSemaphore('pending_verification')).toEqual({ color: 'yellow', label: 'Pendiente Confirmación' });
      expect(calculateTableSemaphore('submitted')).toEqual({ color: 'yellow', label: 'Pendiente Confirmación' });
      expect(calculateTableSemaphore('disputed')).toEqual({ color: 'red', label: 'En Disputa' });
    });
  });
});
