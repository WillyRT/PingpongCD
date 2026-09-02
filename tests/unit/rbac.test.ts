import { describe, it, expect } from 'vitest';
import { SUPER_ADMIN_EMAIL, isSuperAdminProfile, isApprovedAdmin, isApprovedStaff, evaluateUserPermissions } from '../../lib/auth/roles';

describe('RBAC & Superadmin Permissions', () => {
  it('should designate guillermoriveraterriza@gmail.com as the principal Superadmin', () => {
    expect(SUPER_ADMIN_EMAIL).toBe('guillermoriveraterriza@gmail.com');
  });

  it('should correctly evaluate super_admin privileges with isSuperAdminProfile', () => {
    expect(isSuperAdminProfile({ email: 'guillermoriveraterriza@gmail.com', role: 'player' })).toBe(true);
    expect(isSuperAdminProfile({ email: 'other@example.com', role: 'super_admin' })).toBe(true);
    expect(isSuperAdminProfile({ email: 'admin@example.com', role: 'admin' })).toBe(false);
    expect(isSuperAdminProfile({ email: 'player@example.com', role: 'player' })).toBe(false);
  });

  it('should require admin_status="approved" for isApprovedAdmin', () => {
    expect(isApprovedAdmin({ role: 'admin', admin_status: 'approved' })).toBe(true);
    expect(isApprovedAdmin({ role: 'admin', admin_status: 'pending' })).toBe(false);
    expect(isApprovedAdmin({ role: 'admin', admin_status: 'none' })).toBe(false);
    expect(isApprovedAdmin({ role: 'player', admin_status: 'approved' })).toBe(false);
  });

  it('should evaluate isApprovedStaff for referees and approved admins', () => {
    expect(isApprovedStaff({ role: 'referee', admin_status: null })).toBe(true);
    expect(isApprovedStaff({ role: 'admin', admin_status: 'approved' })).toBe(true);
    expect(isApprovedStaff({ role: 'admin', admin_status: 'pending' })).toBe(false);
    expect(isApprovedStaff({ role: 'player', admin_status: null })).toBe(false);
  });

  it('should support dynamic ROOT_SUPERADMIN_EMAIL from environment variables', () => {
    const original = process.env.ROOT_SUPERADMIN_EMAIL;
    process.env.ROOT_SUPERADMIN_EMAIL = 'custom-admin@ciudadducal.com';

    expect(isSuperAdminProfile({ email: 'custom-admin@ciudadducal.com', role: 'player' })).toBe(true);
    expect(isSuperAdminProfile({ email: 'stranger@example.com', role: 'player' })).toBe(false);

    if (original !== undefined) {
      process.env.ROOT_SUPERADMIN_EMAIL = original;
    } else {
      delete process.env.ROOT_SUPERADMIN_EMAIL;
    }
  });

  it('should correctly evaluate full 4-tier hierarchy with evaluateUserPermissions', () => {
    const superUser = evaluateUserPermissions({ role: 'super_admin' });
    expect(superUser.isSuperAdmin).toBe(true);
    expect(superUser.isAdmin).toBe(true);
    expect(superUser.isReferee).toBe(true);

    const adminUser = evaluateUserPermissions({ role: 'admin', admin_status: 'approved' });
    expect(adminUser.isSuperAdmin).toBe(false);
    expect(adminUser.isAdmin).toBe(true);
    expect(adminUser.isReferee).toBe(true);

    const refereeUser = evaluateUserPermissions({ role: 'referee' });
    expect(refereeUser.isSuperAdmin).toBe(false);
    expect(refereeUser.isAdmin).toBe(false);
    expect(refereeUser.isReferee).toBe(true);

    const regularPlayer = evaluateUserPermissions({ role: 'player' });
    expect(regularPlayer.isSuperAdmin).toBe(false);
    expect(regularPlayer.isAdmin).toBe(false);
    expect(regularPlayer.isReferee).toBe(false);
  });
});
