import { describe, it, expect } from 'vitest';
import { SUPER_ADMIN_EMAIL } from '../../lib/engine/constants';

describe('RBAC & Superadmin Permissions', () => {
  it('should designate guillermoriveraterriza@gmail.com as the principal Superadmin', () => {
    expect(SUPER_ADMIN_EMAIL).toBe('guillermoriveraterriza@gmail.com');
  });

  it('should correctly evaluate super_admin privileges', () => {
    function checkSuperAdmin(user: { email: string; role: string }) {
      return (
        user.role === 'super_admin' ||
        user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()
      );
    }

    expect(checkSuperAdmin({ email: 'guillermoriveraterriza@gmail.com', role: 'player' })).toBe(true);
    expect(checkSuperAdmin({ email: 'other@example.com', role: 'super_admin' })).toBe(true);
    expect(checkSuperAdmin({ email: 'admin@example.com', role: 'admin' })).toBe(false);
    expect(checkSuperAdmin({ email: 'player@example.com', role: 'player' })).toBe(false);
  });

  it('should allow both admin and super_admin for tournament administration', () => {
    function canAdministerTournament(user: { email: string; role: string }) {
      return (
        user.role === 'super_admin' ||
        user.role === 'admin' ||
        user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()
      );
    }

    expect(canAdministerTournament({ email: 'guillermoriveraterriza@gmail.com', role: 'player' })).toBe(true);
    expect(canAdministerTournament({ email: 'manager@example.com', role: 'admin' })).toBe(true);
    expect(canAdministerTournament({ email: 'player@example.com', role: 'player' })).toBe(false);
  });
});
