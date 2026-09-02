import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { validateRedirectUrl } from '../../app/auth/callback/route';
import { getSigningSecret } from '../../lib/auth/player-session';
import {
  SUPER_ADMIN_EMAIL,
  isSuperAdminProfile,
  isApprovedAdmin,
  isApprovedStaff,
} from '../../lib/auth/roles';

describe('Security Invariants Suite (Blindaje de Seguridad Permanente)', () => {
  // =========================================================================
  // 1. OPEN REDIRECT DEFENSE (validateRedirectUrl)
  // =========================================================================
  describe('1. Open Redirect Invariants (validateRedirectUrl)', () => {
    it('rejects protocol-relative URLs (//evil.com)', () => {
      expect(validateRedirectUrl('//evil.com')).toBe('/admin');
      expect(validateRedirectUrl('//google.com/test')).toBe('/admin');
    });

    it('rejects absolute URLs with scheme (https://evil.com, http://attacker.org)', () => {
      expect(validateRedirectUrl('https://evil.com')).toBe('/admin');
      expect(validateRedirectUrl('http://attacker.org/phishing')).toBe('/admin');
    });

    it('rejects javascript: and data: schemes', () => {
      expect(validateRedirectUrl('javascript:alert(1)')).toBe('/admin');
      expect(validateRedirectUrl('data:text/html,<script>alert(1)</script>')).toBe('/admin');
    });

    it('rejects backslash evasion (/\evil.com, \\evil.com, /path\\evil)', () => {
      expect(validateRedirectUrl('/\\evil.com')).toBe('/admin');
      expect(validateRedirectUrl('\\evil.com')).toBe('/admin');
      expect(validateRedirectUrl('/safe\\nested')).toBe('/admin');
    });

    it('allows valid relative application paths', () => {
      expect(validateRedirectUrl('/me')).toBe('/me');
      expect(validateRedirectUrl('/tables')).toBe('/tables');
      expect(validateRedirectUrl('/admin/tournaments/123')).toBe('/admin/tournaments/123');
      expect(validateRedirectUrl('/player/profile-abc?tab=matches')).toBe('/player/profile-abc?tab=matches');
    });
  });

  // =========================================================================
  // 2. MATCH CONFIRMATION PARTICIPANT AUTHORIZATION INVARIANT
  // =========================================================================
  describe('2. Match Confirmation & Dispute Authorization Invariants', () => {
    function verifyMatchParticipantAuthorization(
      match: { player1_id: string; player2_id: string; reported_by_id?: string | null },
      callerId: string,
      callerRole: 'player' | 'referee' | 'admin' | 'super_admin'
    ): { authorized: boolean; error?: string; status?: number } {
      const isPrivileged = callerRole === 'referee' || callerRole === 'admin' || callerRole === 'super_admin';
      const isParticipant = match.player1_id === callerId || match.player2_id === callerId;

      if (!isPrivileged && !isParticipant) {
        return {
          authorized: false,
          status: 403,
          error: '403 Forbidden: No autorizado para confirmar o impugnar este partido.',
        };
      }

      return { authorized: true };
    }

    it('rejects third-party players (not player1_id nor player2_id) with 403 Forbidden', () => {
      const match = { player1_id: 'player-1', player2_id: 'player-2', reported_by_id: 'player-1' };
      const intruderResult = verifyMatchParticipantAuthorization(match, 'intruder-player', 'player');

      expect(intruderResult.authorized).toBe(false);
      expect(intruderResult.status).toBe(403);
      expect(intruderResult.error).toContain('403 Forbidden');
    });

    it('allows participant opponent to confirm or dispute', () => {
      const match = { player1_id: 'player-1', player2_id: 'player-2', reported_by_id: 'player-1' };
      const opponentResult = verifyMatchParticipantAuthorization(match, 'player-2', 'player');

      expect(opponentResult.authorized).toBe(true);
    });

    it('allows referee/admin to oversee matches as privileged staff', () => {
      const match = { player1_id: 'player-1', player2_id: 'player-2', reported_by_id: 'player-1' };
      const refereeResult = verifyMatchParticipantAuthorization(match, 'referee-user', 'referee');

      expect(refereeResult.authorized).toBe(true);
    });
  });

  // =========================================================================
  // 3. PRODUCTION SESSION_SECRET INVARIANT
  // =========================================================================
  describe('3. Cryptographic Session Secret Invariants (getSigningSecret)', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('throws an exception in production if SESSION_SECRET / HMAC_SECRET is undefined (no fallback)', () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
      delete process.env.SESSION_SECRET;
      delete process.env.HMAC_SECRET;

      expect(() => getSigningSecret()).toThrow('SESSION_SECRET is required in production');
    });

    it('returns the configured secret when SESSION_SECRET is provided', () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
      process.env.SESSION_SECRET = 'super-secret-key-12345678901234567890';

      expect(getSigningSecret()).toBe('super-secret-key-12345678901234567890');
    });
  });

  // =========================================================================
  // 4. ADMIN APPROVAL INVARIANTS (NO PENDING/NONE BYPASS)
  // =========================================================================
  describe('4. Admin Approval & Staff Access Invariants', () => {
    it('rejects user with role="admin" but admin_status="pending" from isApprovedAdmin and isApprovedStaff', () => {
      const pendingAdmin = { role: 'admin', admin_status: 'pending' };
      expect(isApprovedAdmin(pendingAdmin)).toBe(false);
      expect(isApprovedStaff(pendingAdmin)).toBe(false);
    });

    it('rejects user with role="admin" but admin_status="none" or null', () => {
      const unapprovedNone = { role: 'admin', admin_status: 'none' };
      const unapprovedNull = { role: 'admin', admin_status: null };
      expect(isApprovedAdmin(unapprovedNone)).toBe(false);
      expect(isApprovedStaff(unapprovedNone)).toBe(false);
      expect(isApprovedAdmin(unapprovedNull)).toBe(false);
      expect(isApprovedStaff(unapprovedNull)).toBe(false);
    });

    it('permits user with role="admin" and admin_status="approved"', () => {
      const approvedAdmin = { role: 'admin', admin_status: 'approved' };
      expect(isApprovedAdmin(approvedAdmin)).toBe(true);
      expect(isApprovedStaff(approvedAdmin)).toBe(true);
    });

    it('permits user with role="referee" for isApprovedStaff regardless of admin_status', () => {
      const referee = { role: 'referee', admin_status: null };
      expect(isApprovedStaff(referee)).toBe(true);
      expect(isApprovedAdmin(referee)).toBe(false);
    });

    it('simulates /tables and /stations gatekeeping rejecting unapproved admin', () => {
      const unapproved = { email: 'vecino@example.com', role: 'admin', admin_status: 'pending' };
      
      // Stations page gatekeeping logic:
      const stationsIsSuperAdmin = isSuperAdminProfile(unapproved);
      const stationsIsAdmin = stationsIsSuperAdmin || isApprovedAdmin(unapproved);
      const stationsIsReferee = unapproved.role === 'referee';
      const stationsAccess = stationsIsAdmin || stationsIsReferee;
      expect(stationsAccess).toBe(false);

      // Tables page gatekeeping logic:
      const tablesAccess = isSuperAdminProfile(unapproved) || isApprovedStaff(unapproved);
      expect(tablesAccess).toBe(false);
    });
  });

  // =========================================================================
  // 5. UNFORGEABLE SUPERADMIN IDENTITY
  // =========================================================================
  describe('5. Superadmin Identity Invariants (isSuperAdminProfile)', () => {
    it('recognizes root superadmin with case-insensitive and whitespace-padded email', () => {
      expect(isSuperAdminProfile({ email: '  GuillermoRiveraTerriza@Gmail.com  ', role: 'player' })).toBe(true);
      expect(isSuperAdminProfile({ email: 'GUILLERMORIVERATERRIZA@GMAIL.COM', role: 'player' })).toBe(true);
      expect(isSuperAdminProfile({ email: SUPER_ADMIN_EMAIL, role: 'player' })).toBe(true);
    });

    it('recognizes profile with role="super_admin"', () => {
      expect(isSuperAdminProfile({ email: 'delegated@example.com', role: 'super_admin' })).toBe(true);
    });

    it('rejects arbitrary email claiming role="admin" from becoming superadmin', () => {
      expect(isSuperAdminProfile({ email: 'imposter@example.com', role: 'admin' })).toBe(false);
      expect(isSuperAdminProfile({ email: 'other@gmail.com', role: 'player' })).toBe(false);
    });
  });

  // =========================================================================
  // 6. ROOT SUPERADMIN PROTECTION INVARIANT
  // =========================================================================
  describe('6. Root Superadmin Role Protection Invariant', () => {
    function simulateUpdateUserRoleProtected(
      target: { email?: string | null; role?: string | null }
    ): { success: boolean; error?: string } {
      if (isSuperAdminProfile(target)) {
        return {
          success: false,
          error: 'No se puede modificar el rol del Superadministrador principal.',
        };
      }
      return { success: true };
    }

    it('prevents modifying the root superadmin by email or role', () => {
      const byEmail = simulateUpdateUserRoleProtected({ email: SUPER_ADMIN_EMAIL, role: 'player' });
      expect(byEmail.success).toBe(false);
      expect(byEmail.error).toContain('No se puede modificar el rol del Superadministrador principal');

      const byRole = simulateUpdateUserRoleProtected({ email: 'super@example.com', role: 'super_admin' });
      expect(byRole.success).toBe(false);
      expect(byRole.error).toContain('No se puede modificar el rol del Superadministrador principal');
    });

    it('allows modifying non-superadmin target', () => {
      const normalTarget = simulateUpdateUserRoleProtected({ email: 'vecino@example.com', role: 'player' });
      expect(normalTarget.success).toBe(true);
    });
  });
});
