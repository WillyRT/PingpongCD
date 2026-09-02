export const SUPER_ADMIN_EMAIL = 'guillermoriveraterriza@gmail.com';

/**
 * Centralized helper to check if a profile belongs to the Superadmin.
 * Normalizes email (lowercase + trim) and checks role === 'super_admin'.
 */
export function isSuperAdminProfile(
  profile: { email?: string | null; role?: string | null } | null | undefined
): boolean {
  return (
    profile?.role === 'super_admin' ||
    profile?.email?.toLowerCase().trim() === SUPER_ADMIN_EMAIL
  );
}

/**
 * Checks if a profile is an approved administrator (requires role='admin' AND admin_status='approved').
 */
export function isApprovedAdmin(
  profile: { role?: string | null; admin_status?: string | null } | null | undefined
): boolean {
  return profile?.role === 'admin' && profile?.admin_status === 'approved';
}

/**
 * Checks if a profile is approved staff (referee or approved admin).
 */
export function isApprovedStaff(
  profile: { role?: string | null; admin_status?: string | null } | null | undefined
): boolean {
  return profile?.role === 'referee' || isApprovedAdmin(profile);
}
