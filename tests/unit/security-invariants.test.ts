import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { validateRedirectUrl } from '../../app/auth/callback/route';
import { getSigningSecret } from '../../lib/auth/player-session';
import {
  SUPER_ADMIN_EMAIL,
  isSuperAdminProfile,
  isApprovedAdmin,
  isApprovedStaff,
  canConfirmOrDisputeMatch,
  authorizeRoleChange,
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
  // 2. MATCH CONFIRMATION & DISPUTE AUTHORIZATION INVARIANT (canConfirmOrDisputeMatch)
  // =========================================================================
  describe('2. Match Confirmation & Dispute Authorization Invariants (canConfirmOrDisputeMatch)', () => {
    const sampleMatch = {
      player1_id: 'player-1',
      player2_id: 'player-2',
      reported_by_id: 'player-1',
    };

    it('rejects third-party players (not player1_id nor player2_id)', () => {
      expect(canConfirmOrDisputeMatch(sampleMatch, 'intruder-player', 'player')).toBe(false);
    });

    it('allows match participant players (player1 or player2)', () => {
      expect(canConfirmOrDisputeMatch(sampleMatch, 'player-1', 'player')).toBe(true);
      expect(canConfirmOrDisputeMatch(sampleMatch, 'player-2', 'player')).toBe(true);
    });

    it('allows privileged staff (referee, admin, super_admin) regardless of match participants', () => {
      expect(canConfirmOrDisputeMatch(sampleMatch, 'referee-user', 'referee')).toBe(true);
      expect(canConfirmOrDisputeMatch(sampleMatch, 'admin-user', 'admin')).toBe(true);
      expect(canConfirmOrDisputeMatch(sampleMatch, 'super-user', 'super_admin')).toBe(true);
    });
  });

  // =========================================================================
  // 3. PRODUCTION SESSION_SECRET INVARIANT (getSigningSecret)
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
  // 4. ADMIN APPROVAL INVARIANTS (isApprovedAdmin & isApprovedStaff)
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
  // 5. UNFORGEABLE SUPERADMIN IDENTITY (isSuperAdminProfile)
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
  // 6. TIERED ROLE AUTHORIZATION & ROOT PROTECTION (authorizeRoleChange)
  // =========================================================================
  describe('6. Tiered Role Authorization & Root Protection (authorizeRoleChange)', () => {
    it('prevents modifying the root superadmin by email or role', () => {
      const caller = { email: SUPER_ADMIN_EMAIL, role: 'super_admin', admin_status: 'approved' };
      
      const byEmail = authorizeRoleChange(caller, { email: SUPER_ADMIN_EMAIL, role: 'player' }, 'player');
      expect(byEmail.allowed).toBe(false);
      if (!byEmail.allowed) {
        expect(byEmail.error).toContain('No se puede modificar el rol del Superadministrador principal');
      }

      const byRole = authorizeRoleChange(caller, { email: 'other@example.com', role: 'super_admin' }, 'player');
      expect(byRole.allowed).toBe(false);
      if (!byRole.allowed) {
        expect(byRole.error).toContain('No se puede modificar el rol del Superadministrador principal');
      }
    });

    it('rejects unapproved admin or player caller from modifying roles', () => {
      const unapprovedCaller = { email: 'pending@example.com', role: 'admin', admin_status: 'pending' };
      const playerCaller = { email: 'player@example.com', role: 'player', admin_status: null };
      const target = { email: 'target@example.com', role: 'player' };

      const res1 = authorizeRoleChange(unapprovedCaller, target, 'referee');
      expect(res1.allowed).toBe(false);

      const res2 = authorizeRoleChange(playerCaller, target, 'referee');
      expect(res2.allowed).toBe(false);
    });

    it('rejects approved admin attempting to assign admin role', () => {
      const adminCaller = { email: 'admin@example.com', role: 'admin', admin_status: 'approved' };
      const target = { email: 'target@example.com', role: 'player' };

      const res = authorizeRoleChange(adminCaller, target, 'admin');
      expect(res.allowed).toBe(false);
      if (!res.allowed) {
        expect(res.error).toContain('Solo el Superadministrador puede designar administradores');
      }
    });

    it('rejects approved admin attempting to modify another admin', () => {
      const adminCaller = { email: 'admin@example.com', role: 'admin', admin_status: 'approved' };
      const targetAdmin = { email: 'other_admin@example.com', role: 'admin' };

      const res = authorizeRoleChange(adminCaller, targetAdmin, 'player');
      expect(res.allowed).toBe(false);
      if (!res.allowed) {
        expect(res.error).toContain('Solo el Superadministrador puede modificar a otros administradores');
      }
    });

    it('allows approved admin to assign referee role to a player', () => {
      const adminCaller = { email: 'admin@example.com', role: 'admin', admin_status: 'approved' };
      const target = { email: 'target@example.com', role: 'player' };

      const res = authorizeRoleChange(adminCaller, target, 'referee');
      expect(res.allowed).toBe(true);
    });

    it('allows approved admin to demote referee to player', () => {
      const adminCaller = { email: 'admin@example.com', role: 'admin', admin_status: 'approved' };
      const target = { email: 'referee@example.com', role: 'referee' };

      const res = authorizeRoleChange(adminCaller, target, 'player');
      expect(res.allowed).toBe(true);
    });

    it('allows superadmin to assign admin, referee, or player to any eligible target', () => {
      const superCaller = { email: SUPER_ADMIN_EMAIL, role: 'super_admin', admin_status: 'approved' };
      const target = { email: 'target@example.com', role: 'player' };

      expect(authorizeRoleChange(superCaller, target, 'admin').allowed).toBe(true);
      expect(authorizeRoleChange(superCaller, target, 'referee').allowed).toBe(true);
      expect(authorizeRoleChange(superCaller, target, 'player').allowed).toBe(true);
    });
  });
});
