import { describe, it, expect } from 'vitest';
import { SUPER_ADMIN_EMAIL, isSuperAdminProfile, isApprovedAdmin, isApprovedStaff } from '../../lib/auth/roles';

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
});
