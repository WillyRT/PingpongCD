import { SUPER_ADMIN_EMAIL } from '@/lib/engine/constants';

/**
 * Centralized synchronous helper to verify if a profile represents the Superadmin.
 * Checks role === 'super_admin' or email === 'guillermoriveraterriza@gmail.com'.
 */
export function isSuperAdminProfile(
  profile: { email?: string | null; role?: string } | null | undefined
): boolean {
  if (!profile) return false;
  return (
    profile.role === 'super_admin' ||
    profile.email?.toLowerCase().trim() === SUPER_ADMIN_EMAIL
  );
}

/**
 * Helper to check if a user is an approved admin (or superadmin).
 */
export function isApprovedAdminProfile(
  profile: { email?: string | null; role?: string; admin_status?: string | null } | null | undefined
): boolean {
  if (!profile) return false;
  if (isSuperAdminProfile(profile)) return true;
  return profile.role === 'admin' && profile.admin_status === 'approved';
}
