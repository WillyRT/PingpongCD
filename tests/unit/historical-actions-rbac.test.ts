import { describe, it, expect, vi, beforeEach } from 'vitest';
import { importHistoricalDataAction, resolveIdentityAction } from '@/lib/actions/historical';
import { createClient } from '@/lib/supabase/server';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('Historical Actions RBAC (tests/unit/historical-actions-rbac.test.ts)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setupAuthContext(callerUser: { id: string; email: string; role: string } | null) {
    const chainable = () => ({
      select: () => ({
        single: async () => ({ data: { id: 'mock-id' }, error: null }),
        eq: () => ({
          single: async () => ({
            data: callerUser ? { role: callerUser.role } : null,
            error: null,
          }),
        }),
      }),
      insert: () => ({
        select: () => ({
          single: async () => ({ data: { id: 'mock-id' }, error: null }),
        }),
      }),
      upsert: () => ({
        select: () => ({
          single: async () => ({ data: { id: 'mock-id' }, error: null }),
        }),
      }),
      update: () => ({
        eq: () => Promise.resolve({ error: null }),
      }),
    });

    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: callerUser ? { id: callerUser.id, email: callerUser.email } : null },
        }),
      },
      from: (table: string) => {
        if (table === 'profiles') {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: callerUser ? { role: callerUser.role } : null,
                  error: null,
                }),
              }),
            }),
          };
        }
        return {
          select: () => Promise.resolve({ data: [], error: null }),
          insert: () => ({
            select: () => ({
              single: async () => ({ data: { id: 'mock-id' }, error: null }),
            }),
          }),
          upsert: () => ({
            select: () => ({
              single: async () => ({ data: { id: 'mock-id' }, error: null }),
            }),
          }),
          update: () => ({
            eq: () => Promise.resolve({ error: null }),
          }),
        };
      },
    };

    vi.mocked(createClient).mockResolvedValue(mockClient as any);
  }

  it('rejects unauthenticated user for importHistoricalDataAction', async () => {
    setupAuthContext(null);
    const res = await importHistoricalDataAction({
      sourceName: 'Test',
      records: [],
    });
    expect(res.success).toBe(false);
    expect(res.error).toBe('Unauthorized');
  });

  it('rejects player for importHistoricalDataAction with "Permisos insuficientes"', async () => {
    setupAuthContext({ id: 'p1', email: 'player@example.com', role: 'player' });
    const res = await importHistoricalDataAction({
      sourceName: 'Test',
      records: [],
    });
    expect(res.success).toBe(false);
    expect(res.error).toBe('Permisos insuficientes');
  });

  it('allows super_admin to import historical data', async () => {
    setupAuthContext({ id: 'sa-1', email: 'superadmin@example.com', role: 'super_admin' });
    const res = await importHistoricalDataAction({
      sourceName: 'Test Import',
      records: [],
    });
    expect(res.success).toBe(true);
    expect(res.data?.importedTournaments).toBe(0);
  });

  it('allows admin to import historical data', async () => {
    setupAuthContext({ id: 'adm-1', email: 'admin@example.com', role: 'admin' });
    const res = await importHistoricalDataAction({
      sourceName: 'Test Import',
      records: [],
    });
    expect(res.success).toBe(true);
  });

  it('rejects player for resolveIdentityAction with "Permisos insuficientes"', async () => {
    setupAuthContext({ id: 'p1', email: 'player@example.com', role: 'player' });
    const res = await resolveIdentityAction({
      aliasId: 'alias-1',
      targetPlayerId: 'player-1',
      action: 'confirm_merge',
    });
    expect(res.success).toBe(false);
    expect(res.error).toBe('Permisos insuficientes');
  });

  it('allows super_admin to resolve identity', async () => {
    setupAuthContext({ id: 'sa-1', email: 'superadmin@example.com', role: 'super_admin' });
    const res = await resolveIdentityAction({
      aliasId: 'alias-1',
      targetPlayerId: 'player-1',
      action: 'confirm_merge',
    });
    expect(res.success).toBe(true);
    expect(res.data?.resolved).toBe(true);
  });
});
