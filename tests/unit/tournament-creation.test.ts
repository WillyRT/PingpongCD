import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTournamentAction } from '@/lib/actions/tournament';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('Robustez de Creación de Torneos (lib/actions/tournament.ts)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects tournament creation when user is not authenticated', async () => {
    const { createClient, createAdminClient } = await import('@/lib/supabase/server');
    (createClient as any).mockReturnValue({
      auth: {
        getUser: async () => ({ data: { user: null } }),
      },
    });
    (createAdminClient as any).mockReturnValue({
      from: vi.fn(),
    });

    const res = await createTournamentAction({
      name: 'Torneo Sin Auth',
      hiddenStandings: true,
    });

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/Unauthorized/i);
  });

  it('rejects tournament creation when user has role player (unauthorized)', async () => {
    const { createClient, createAdminClient } = await import('@/lib/supabase/server');
    (createClient as any).mockReturnValue({
      auth: {
        getUser: async () => ({
          data: { user: { id: 'player-id', email: 'regular@player.com' } },
        }),
      },
    });

    (createAdminClient as any).mockReturnValue({
      from: () => ({
        select: () => ({
          or: () => ({
            maybeSingle: async () => ({
              data: { role: 'player', admin_status: 'none' },
            }),
          }),
        }),
      }),
    });

    const res = await createTournamentAction({
      name: 'Torneo Jugador',
      hiddenStandings: true,
    });

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/Solo administradores autorizados/i);
  });

  it('allows tournament creation and inserts via admin client for superadmin', async () => {
    const { createClient, createAdminClient } = await import('@/lib/supabase/server');
    const { revalidatePath } = await import('next/cache');

    const mockAdminInsert = vi.fn().mockReturnValue({
      select: () => ({
        single: async () => ({
          data: { id: 'tourney-123', slug: 'torneo-oficial-2026', name: 'Torneo Oficial 2026' },
          error: null,
        }),
      }),
    });

    const mockConfigInsert = vi.fn().mockResolvedValue({ error: null });
    const mockAuditInsert = vi.fn().mockResolvedValue({ error: null });

    (createClient as any).mockReturnValue({
      auth: {
        getUser: async () => ({
          data: { user: { id: 'admin-id', email: 'guillermoriveraterriza@gmail.com' } },
        }),
      },
    });

    (createAdminClient as any).mockReturnValue({
      from: (table: string) => {
        if (table === 'profiles') {
          return {
            select: () => ({
              or: () => ({
                maybeSingle: async () => ({
                  data: { role: 'super_admin', admin_status: 'approved' },
                }),
              }),
            }),
          };
        }
        if (table === 'tournaments') {
          return {
            insert: mockAdminInsert,
          };
        }
        if (table === 'tournament_config') {
          return {
            insert: mockConfigInsert,
          };
        }
        if (table === 'audit_logs') {
          return {
            insert: mockAuditInsert,
          };
        }
        return { select: vi.fn(), insert: vi.fn() };
      },
    });

    const res = await createTournamentAction({
      name: 'Torneo Oficial 2026',
      hiddenStandings: false,
    });

    expect(res.success).toBe(true);
    expect(res.data?.id).toBe('tourney-123');
    expect(mockAdminInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Torneo Oficial 2026',
        created_by: 'admin-id',
        status: 'draft',
      })
    );
    expect(revalidatePath).toHaveBeenCalledWith('/');
    expect(revalidatePath).toHaveBeenCalledWith('/tournaments');
    expect(revalidatePath).toHaveBeenCalledWith('/admin');
  });

  it('tags tournament correctly when tournamentType is test', async () => {
    const { createClient, createAdminClient } = await import('@/lib/supabase/server');
    const mockAdminInsert = vi.fn().mockReturnValue({
      select: () => ({
        single: async () => ({
          data: { id: 'tourney-test-456', slug: 'torneo-test-456' },
          error: null,
        }),
      }),
    });

    (createClient as any).mockReturnValue({
      auth: {
        getUser: async () => ({
          data: { user: { id: 'admin-id', email: 'guillermoriveraterriza@gmail.com' } },
        }),
      },
    });

    (createAdminClient as any).mockReturnValue({
      from: (table: string) => {
        if (table === 'profiles') {
          return {
            select: () => ({
              or: () => ({
                maybeSingle: async () => ({
                  data: { role: 'super_admin', admin_status: 'approved' },
                }),
              }),
            }),
          };
        }
        if (table === 'tournaments') {
          return { insert: mockAdminInsert };
        }
        return { insert: vi.fn().mockResolvedValue({ error: null }) };
      },
    });

    const res = await createTournamentAction({
      name: 'Exhibición Primavera',
      hiddenStandings: true,
      tournamentType: 'test',
    });

    expect(res.success).toBe(true);
    expect(mockAdminInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        name: '[Prueba] Exhibición Primavera',
        status: 'draft',
      })
    );
  });
});
