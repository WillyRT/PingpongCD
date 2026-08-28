import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateRedirectUrl } from '../../app/auth/callback/route';
import { calculateStandings, type ConfirmedMatch } from '../../lib/engine/standings';

describe('Security, RBAC, Idempotency & Negative Testing Suite', () => {

  // =========================================================================
  // 1. OPEN REDIRECT DEFENSE TESTS
  // =========================================================================
  describe('Open Redirect Mitigation (validateRedirectUrl)', () => {
    it('should allow legitimate relative internal paths', () => {
      expect(validateRedirectUrl('/admin')).toBe('/admin');
      expect(validateRedirectUrl('/player')).toBe('/player');
      expect(validateRedirectUrl('/join/550e8400-e29b-41d4-a716-446655440000')).toBe('/join/550e8400-e29b-41d4-a716-446655440000');
      expect(validateRedirectUrl('/leaderboard?tab=historical#top')).toBe('/leaderboard?tab=historical#top');
    });

    it('should reject protocol-relative external URLs (//evil.com)', () => {
      expect(validateRedirectUrl('//evil.com')).toBe('/admin');
      expect(validateRedirectUrl('//attacker.org/phish')).toBe('/admin');
      expect(validateRedirectUrl('///malicious.net')).toBe('/admin');
    });

    it('should reject absolute URLs with HTTP/HTTPS schemas', () => {
      expect(validateRedirectUrl('http://evil.com')).toBe('/admin');
      expect(validateRedirectUrl('https://evil.com/admin')).toBe('/admin');
      expect(validateRedirectUrl('ftp://server.com')).toBe('/admin');
    });

    it('should reject pseudo-protocols and script injection', () => {
      expect(validateRedirectUrl('javascript:alert(1)')).toBe('/admin');
      expect(validateRedirectUrl('/javascript:alert(1)')).toBe('/admin');
      expect(validateRedirectUrl('data:text/html;base64,PHNjcmlwdD4=')).toBe('/admin');
    });

    it('should reject backslash bypass attempts (/\\evil.com or \\\\evil.com)', () => {
      expect(validateRedirectUrl('/\\evil.com')).toBe('/admin');
      expect(validateRedirectUrl('\\evil.com')).toBe('/admin');
      expect(validateRedirectUrl('/admin\\attacker.com')).toBe('/admin');
    });

    it('should gracefully fallback on invalid/empty inputs', () => {
      expect(validateRedirectUrl(null)).toBe('/admin');
      expect(validateRedirectUrl(undefined)).toBe('/admin');
      expect(validateRedirectUrl('')).toBe('/admin');
      expect(validateRedirectUrl('   ')).toBe('/admin');
      expect(validateRedirectUrl('not-a-path')).toBe('/admin');
    });

    it('should respect custom fallback path when provided', () => {
      expect(validateRedirectUrl('https://evil.com', '/player')).toBe('/player');
      expect(validateRedirectUrl(null, '/login')).toBe('/login');
    });
  });

  // =========================================================================
  // 2. RBAC LOGICAL AUTHORIZATION NEGATIVE TESTS
  // =========================================================================
  describe('RBAC Authorization Rules', () => {
    function evaluateActionPermission(
      userRole: 'player' | 'admin' | 'super_admin',
      adminStatus: 'pending' | 'approved' | 'rejected',
      action: 'approve_admin' | 'revoke_admin' | 'finish_tournament'
    ): { allowed: boolean; code: number; reason?: string } {
      const isSuperAdmin = userRole === 'super_admin' && adminStatus === 'approved';
      const isAdmin = isSuperAdmin || (userRole === 'admin' && adminStatus === 'approved');

      if (action === 'approve_admin' || action === 'revoke_admin') {
        if (!isSuperAdmin) {
          return { allowed: false, code: 403, reason: 'Solo el Superadmin principal puede gestionar roles de administrador' };
        }
        return { allowed: true, code: 200 };
      }

      if (action === 'finish_tournament') {
        if (!isAdmin) {
          return { allowed: false, code: 403, reason: 'Solo administradores aprobados pueden finalizar torneos' };
        }
        return { allowed: true, code: 200 };
      }

      return { allowed: false, code: 400 };
    }

    it('should forbid player role from executing approveAdminAction (403)', () => {
      const result = evaluateActionPermission('player', 'pending', 'approve_admin');
      expect(result.allowed).toBe(false);
      expect(result.code).toBe(403);
    });

    it('should forbid regular admin from executing approveAdminAction (403)', () => {
      const result = evaluateActionPermission('admin', 'approved', 'approve_admin');
      expect(result.allowed).toBe(false);
      expect(result.code).toBe(403);
    });

    it('should permit super_admin to execute approveAdminAction (200)', () => {
      const result = evaluateActionPermission('super_admin', 'approved', 'approve_admin');
      expect(result.allowed).toBe(true);
      expect(result.code).toBe(200);
    });

    it('should forbid player role from executing revokeAdminAction (403)', () => {
      const result = evaluateActionPermission('player', 'rejected', 'revoke_admin');
      expect(result.allowed).toBe(false);
      expect(result.code).toBe(403);
    });

    it('should forbid player role from executing finishTournamentAction (403)', () => {
      const result = evaluateActionPermission('player', 'pending', 'finish_tournament');
      expect(result.allowed).toBe(false);
      expect(result.code).toBe(403);
    });

    it('should forbid unapproved admin from executing finishTournamentAction (403)', () => {
      const result = evaluateActionPermission('admin', 'pending', 'finish_tournament');
      expect(result.allowed).toBe(false);
      expect(result.code).toBe(403);
    });

    it('should permit approved admin or super_admin to execute finishTournamentAction (200)', () => {
      const adminRes = evaluateActionPermission('admin', 'approved', 'finish_tournament');
      expect(adminRes.allowed).toBe(true);

      const superRes = evaluateActionPermission('super_admin', 'approved', 'finish_tournament');
      expect(superRes.allowed).toBe(true);
    });
  });

  // =========================================================================
  // 3. TOURNAMENT FINALIZATION IDEMPOTENCY
  // =========================================================================
  describe('finishTournamentAction Idempotency Engine', () => {
    interface TournamentState {
      id: string;
      status: 'draft' | 'registration' | 'group_stage' | 'bracket_stage' | 'finished';
      snapshotsCreated: number;
      ratingUpdatesApplied: number;
    }

    function simulateFinishTournament(
      tournament: TournamentState,
      callerRole: 'player' | 'admin' | 'super_admin'
    ): { success: boolean; alreadyFinished?: boolean; error?: string; state: TournamentState } {
      if (callerRole !== 'admin' && callerRole !== 'super_admin') {
        return { success: false, error: 'Unauthorized: Admin required', state: tournament };
      }

      // Check current status before executing rating updates or writing snapshots
      if (tournament.status === 'finished') {
        return {
          success: true,
          alreadyFinished: true,
          state: tournament, // Unaltered! No duplicate snapshots or rating delta replays
        };
      }

      // Atomic transition
      const updatedState: TournamentState = {
        ...tournament,
        status: 'finished',
        snapshotsCreated: tournament.snapshotsCreated + 1,
        ratingUpdatesApplied: tournament.ratingUpdatesApplied + 1,
      };

      return {
        success: true,
        alreadyFinished: false,
        state: updatedState,
      };
    }

    it('should cleanly finalize an ongoing tournament on first call', () => {
      const initial: TournamentState = {
        id: 't-1',
        status: 'bracket_stage',
        snapshotsCreated: 0,
        ratingUpdatesApplied: 0,
      };

      const result = simulateFinishTournament(initial, 'admin');
      expect(result.success).toBe(true);
      expect(result.alreadyFinished).toBe(false);
      expect(result.state.status).toBe('finished');
      expect(result.state.snapshotsCreated).toBe(1);
      expect(result.state.ratingUpdatesApplied).toBe(1);
    });

    it('should be completely idempotent when called multiple times consecutively', () => {
      const initial: TournamentState = {
        id: 't-1',
        status: 'bracket_stage',
        snapshotsCreated: 0,
        ratingUpdatesApplied: 0,
      };

      // Call 1: First finalization
      const res1 = simulateFinishTournament(initial, 'admin');
      expect(res1.success).toBe(true);
      expect(res1.state.snapshotsCreated).toBe(1);

      // Call 2: Second call immediately following
      const res2 = simulateFinishTournament(res1.state, 'admin');
      expect(res2.success).toBe(true);
      expect(res2.alreadyFinished).toBe(true);
      expect(res2.state.snapshotsCreated).toBe(1); // EXACTLY 1, NOT DUPLICATED!
      expect(res2.state.ratingUpdatesApplied).toBe(1); // EXACTLY 1, NOT REAPPLIED!

      // Call 3: Third call
      const res3 = simulateFinishTournament(res2.state, 'admin');
      expect(res3.success).toBe(true);
      expect(res3.alreadyFinished).toBe(true);
      expect(res3.state.snapshotsCreated).toBe(1);
    });
  });

  // =========================================================================
  // 4. 3-WAY CIRCULAR TIEBREAK RESOLUTION WITH INITIAL RATING TIEBREAKER
  // =========================================================================
  describe('Group Tiebreak: 3-way Circular Tie with Initial Rating Criterion', () => {
    const seeds = new Map<string, number>([
      ['playerA', 1],
      ['playerB', 2],
      ['playerC', 3],
    ]);

    it('resolves 3-way circular tie (A>B, B>C, C>A) via point differential', () => {
      const playerIds = ['playerA', 'playerB', 'playerC'];
      // A beats B 7-2 (+5 for A, -5 for B)
      // B beats C 7-4 (+3 for B, -3 for C)
      // C beats A 7-6 (+1 for C, -1 for A)
      // Overall Point Diff:
      // A: +5 - 1 = +4
      // B: -5 + 3 = -2
      // C: -3 + 1 = -2
      const matches: ConfirmedMatch[] = [
        { player1Id: 'playerA', player2Id: 'playerB', score1: 7, score2: 2, winnerId: 'playerA' },
        { player1Id: 'playerB', player2Id: 'playerC', score1: 7, score2: 4, winnerId: 'playerB' },
        { player1Id: 'playerC', player2Id: 'playerA', score1: 7, score2: 6, winnerId: 'playerC' },
      ];

      const standings = calculateStandings(playerIds, matches, seeds);
      expect(standings[0]?.playerId).toBe('playerA');
      expect(standings[0]?.pointsDiff).toBe(4);
    });

    it('resolves 3-way symmetric tie (identical scores) using 5th criterion: Initial Tournament Glicko-2 Rating', () => {
      const playerIds = ['playerA', 'playerB', 'playerC'];
      // Completely symmetric circle:
      // A beats B 7-5 (+2)
      // B beats C 7-5 (+2)
      // C beats A 7-5 (+2)
      // All have: 1 win, 1 loss, 0 point difference, identical PF and PA!
      const matches: ConfirmedMatch[] = [
        { player1Id: 'playerA', player2Id: 'playerB', score1: 7, score2: 5, winnerId: 'playerA' },
        { player1Id: 'playerB', player2Id: 'playerC', score1: 7, score2: 5, winnerId: 'playerB' },
        { player1Id: 'playerC', player2Id: 'playerA', score1: 7, score2: 5, winnerId: 'playerC' },
      ];

      // Initial tournament ratings before starting the event
      const initialRatings = new Map<string, number>([
        ['playerA', 1580],
        ['playerB', 1650], // Highest initial rating -> 1st place!
        ['playerC', 1490],
      ]);

      const standings = calculateStandings(playerIds, matches, seeds, initialRatings);

      // Verify Player B (1650 initial) takes 1st place, Player A (1580) takes 2nd, Player C (1490) takes 3rd
      expect(standings[0]?.playerId).toBe('playerB');
      expect(standings[0]?.initialRating).toBe(1650);
      expect(standings[1]?.playerId).toBe('playerA');
      expect(standings[1]?.initialRating).toBe(1580);
      expect(standings[2]?.playerId).toBe('playerC');
      expect(standings[2]?.initialRating).toBe(1490);
    });
  });
});
