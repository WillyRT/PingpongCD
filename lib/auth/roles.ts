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

/**
 * Pure authorization check for match confirmation and dispute.
 * Evaluates whether caller is allowed to confirm/dispute a match.
 */
export function canConfirmOrDisputeMatch(
  match: { player1_id: string; player2_id: string; reported_by_id?: string | null },
  callerId: string,
  callerRole: 'player' | 'referee' | 'admin' | 'super_admin'
): boolean {
  const isPrivileged = callerRole === 'referee' || callerRole === 'admin' || callerRole === 'super_admin';
  const isParticipant = match.player1_id === callerId || match.player2_id === callerId;
  return isPrivileged || isParticipant;
}

/**
 * Pure authorization check for tiered role assignment.
 * - Superadmin can change anyone's role to any role.
 * - Root superadmin can never be modified.
 * - Approved admin can only assign 'player' or 'referee' to non-admins.
 * - Non-staff callers are denied.
 */
export function authorizeRoleChange(
  caller: { email?: string | null; role?: string | null; admin_status?: string | null } | null | undefined,
  target: { email?: string | null; role?: string | null } | null | undefined,
  newRole: 'player' | 'referee' | 'admin'
): { allowed: true } | { allowed: false; error: string } {
  if (!isSuperAdminProfile(caller) && !isApprovedAdmin(caller)) {
    return { allowed: false, error: 'Acceso denegado: Se requieren permisos de administrador o superadministrador.' };
  }
  if (isSuperAdminProfile(target)) {
    return { allowed: false, error: 'No se puede modificar el rol del Superadministrador principal.' };
  }
  if (!isSuperAdminProfile(caller)) {
    if (target?.role === 'admin' || target?.role === 'super_admin') {
      return { allowed: false, error: 'Solo el Superadministrador puede modificar a otros administradores.' };
    }
    if (newRole === 'admin') {
      return { allowed: false, error: 'Solo el Superadministrador puede designar administradores.' };
    }
  }
  return { allowed: true };
}
