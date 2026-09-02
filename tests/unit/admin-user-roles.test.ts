import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateUserRoleAction } from '@/lib/actions/admin';
import { SUPER_ADMIN_EMAIL } from '@/lib/auth/roles';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { getPlayerSession } from '@/lib/auth/player-session';

// Mock dependencies
vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock('@/lib/auth/player-session', () => ({
  getPlayerSession: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('Admin User Roles Unit Tests (tests/unit/admin-user-roles.test.ts)', () => {
  const rootSuperadminId = '00000000-0000-4000-8000-000000000001';
  const adminId = '00000000-0000-4000-8000-000000000002';
  const refereeId = '00000000-0000-4000-8000-000000000003';
  const playerId = '00000000-0000-4000-8000-000000000004';
  const otherAdminId = '00000000-0000-4000-8000-000000000005';

  const mockDbProfiles: Record<string, { id: string; email: string; role: string; admin_status: string | null }> = {
    [rootSuperadminId]: {
      id: rootSuperadminId,
      email: SUPER_ADMIN_EMAIL,
      role: 'super_admin',
      admin_status: 'approved',
    },
    [adminId]: {
      id: adminId,
      email: 'admin@ciudadducal.com',
      role: 'admin',
      admin_status: 'approved',
    },
    [refereeId]: {
      id: refereeId,
      email: 'referee@ciudadducal.com',
      role: 'referee',
      admin_status: 'approved',
    },
    [playerId]: {
      id: playerId,
      email: 'player@ciudadducal.com',
      role: 'player',
      admin_status: null,
    },
    [otherAdminId]: {
      id: otherAdminId,
      email: 'otheradmin@ciudadducal.com',
      role: 'admin',
      admin_status: 'approved',
    },
  };

  let updateSpy: any;
  let insertSpy: any;

  function setupAuthContext(callerUser: { id: string; email: string } | null) {
    updateSpy = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    insertSpy = vi.fn().mockResolvedValue({ error: null });

    const mockAdminClient = {
      from: (table: string) => {
        if (table === 'audit_logs') {
          return { insert: insertSpy };
        }
        if (table === 'profiles') {
          return {
            select: () => ({
              eq: (_field: string, val: string) => ({
                maybeSingle: vi.fn().mockImplementation(async () => {
                  const profile = Object.values(mockDbProfiles).find(
                    (p) => p.email.toLowerCase() === val.toLowerCase() || p.id === val
                  );
                  return { data: profile ? { ...profile } : null, error: null };
                }),
              }),
            }),
            update: updateSpy,
          };
        }
        return {};
      },
    };

    const mockUserClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: callerUser },
        }),
      },
    };

    vi.mocked(createAdminClient).mockReturnValue(mockAdminClient as any);
    vi.mocked(createClient).mockResolvedValue(mockUserClient as any);
    vi.mocked(getPlayerSession).mockResolvedValue(null);
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. ANONYMOUS & PLAYER RESTRICTIONS
  it('rejects unauthenticated (anonymous) callers with error', async () => {
    setupAuthContext(null);

    const res = await updateUserRoleAction({
      targetUserId: playerId,
      newRole: 'referee',
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain('Acceso denegado');
    expect(updateSpy).not.toHaveBeenCalled();
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('rejects callers with role="player" attempting to modify roles', async () => {
    setupAuthContext({ id: playerId, email: 'player@ciudadducal.com' });

    const res = await updateUserRoleAction({
      targetUserId: playerId,
      newRole: 'referee',
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain('Acceso denegado');
    expect(updateSpy).not.toHaveBeenCalled();
    expect(insertSpy).not.toHaveBeenCalled();
  });

  // 2. APPROVED ADMIN RESTRICTIONS
  it('allows approved admin to promote player to referee', async () => {
    setupAuthContext({ id: adminId, email: 'admin@ciudadducal.com' });

    const res = await updateUserRoleAction({
      targetUserId: playerId,
      newRole: 'referee',
    });

    expect(res.success).toBe(true);
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'referee',
        admin_status: 'approved',
      })
    );
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'update_user_role',
        entity_id: playerId,
      })
    );
  });

  it('allows approved admin to demote referee back to player', async () => {
    setupAuthContext({ id: adminId, email: 'admin@ciudadducal.com' });

    const res = await updateUserRoleAction(refereeId, 'player'); // Positional signature

    expect(res.success).toBe(true);
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'player',
        admin_status: null,
      })
    );
  });

  it('forbids approved admin from promoting anyone to admin', async () => {
    setupAuthContext({ id: adminId, email: 'admin@ciudadducal.com' });

    const res = await updateUserRoleAction({
      targetUserId: playerId,
      newRole: 'admin',
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain('Solo el Superadministrador puede designar administradores');
    expect(updateSpy).not.toHaveBeenCalled();
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('forbids approved admin from modifying another admin', async () => {
    setupAuthContext({ id: adminId, email: 'admin@ciudadducal.com' });

    const res = await updateUserRoleAction({
      targetUserId: otherAdminId,
      newRole: 'player',
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain('Solo el Superadministrador puede modificar a otros administradores');
    expect(updateSpy).not.toHaveBeenCalled();
    expect(insertSpy).not.toHaveBeenCalled();
  });

  // 3. SUPERADMIN PRIVILEGES
  it('allows super_admin to promote player to admin', async () => {
    setupAuthContext({ id: rootSuperadminId, email: SUPER_ADMIN_EMAIL });

    const res = await updateUserRoleAction({
      targetUserId: playerId,
      newRole: 'admin',
    });

    expect(res.success).toBe(true);
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'admin',
        admin_status: 'approved',
      })
    );
  });

  it('allows super_admin to promote player to referee', async () => {
    setupAuthContext({ id: rootSuperadminId, email: SUPER_ADMIN_EMAIL });

    const res = await updateUserRoleAction({
      targetUserId: playerId,
      newRole: 'referee',
    });

    expect(res.success).toBe(true);
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'referee',
        admin_status: 'approved',
      })
    );
  });

  // 4. ROOT SUPERADMIN PROTECTION
  it('strictly forbids demoting or revoking root superadmin (even if caller is superadmin)', async () => {
    setupAuthContext({ id: rootSuperadminId, email: SUPER_ADMIN_EMAIL });

    const res = await updateUserRoleAction({
      targetUserId: rootSuperadminId,
      newRole: 'player',
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain('No se puede modificar el rol del Superadministrador principal');
    expect(updateSpy).not.toHaveBeenCalled();
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('strictly forbids approved admin from modifying root superadmin', async () => {
    setupAuthContext({ id: adminId, email: 'admin@ciudadducal.com' });

    const res = await updateUserRoleAction({
      targetUserId: rootSuperadminId,
      newRole: 'player',
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain('No se puede modificar el rol del Superadministrador principal');
    expect(updateSpy).not.toHaveBeenCalled();
    expect(insertSpy).not.toHaveBeenCalled();
  });

  // 5. INPUT VALIDATION
  it('rejects invalid targetUserId uuid format', async () => {
    setupAuthContext({ id: rootSuperadminId, email: SUPER_ADMIN_EMAIL });

    const res = await updateUserRoleAction({
      targetUserId: 'not-a-valid-uuid',
      newRole: 'referee',
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain('ID de usuario inválido');
    expect(updateSpy).not.toHaveBeenCalled();
  });
});
