import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getRecentChampions } from '@/lib/queries/champions';

// Mock createAdminClient from lib/supabase/server
vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn(),
}));

describe('Consulta Progresiva de Campeones (lib/queries/champions.ts)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns official 2026 base champions when no modern (2027+) tournaments exist', async () => {
    const { createAdminClient } = await import('@/lib/supabase/server');
    (createAdminClient as any).mockReturnValue({
      from: () => ({
        select: () => ({
          in: () => ({
            order: async () => ({
              data: [
                // Tournament in 2026 or before
                {
                  id: 't-2026',
                  name: 'Senior CD 2026',
                  created_at: '2026-08-20T00:00:00Z',
                  matches: [],
                },
              ],
            }),
          }),
        }),
      }),
    });

    const champions = await getRecentChampions();
    expect(champions).toHaveLength(1);
    expect(champions[0]).toEqual({
      year: 2026,
      seniorChampion: 'Juan Pedro González (Jeipi)',
      sub14Champion: 'Pablo Cascón',
    });
  });

  it('includes future completed tournaments (e.g. 2028) along with base 2026', async () => {
    const { createAdminClient } = await import('@/lib/supabase/server');
    (createAdminClient as any).mockReturnValue({
      from: () => ({
        select: () => ({
          in: () => ({
            order: async () => ({
              data: [
                {
                  id: 't-2028-senior',
                  name: 'Senior CD 2028',
                  category: 'plus14',
                  status: 'finished',
                  created_at: '2028-08-15T00:00:00Z',
                  matches: [
                    {
                      stage: 'final',
                      status: 'completed',
                      winner_id: 'p1',
                      player1_id: 'p1',
                      player2_id: 'p2',
                      player1: { name: 'Pablo Olalla' },
                      player2: { name: 'Juan Pedro González' },
                    },
                  ],
                },
                {
                  id: 't-2028-sub14',
                  name: 'Sub-14 CD 2028',
                  category: 'sub14',
                  status: 'finished',
                  created_at: '2028-08-15T00:00:00Z',
                  matches: [
                    {
                      stage: 'final',
                      status: 'completed',
                      winner_id: 'p3',
                      player1_id: 'p3',
                      player2_id: 'p4',
                      player1: { name: 'Campeón Joven' },
                      player2: { name: 'Finalista Joven' },
                    },
                  ],
                },
              ],
            }),
          }),
        }),
      }),
    });

    const champions = await getRecentChampions();
    expect(champions).toHaveLength(2);
    expect(champions[0]?.year).toBe(2028);
    expect(champions[0]?.seniorChampion).toBe('Pablo Olalla');
    expect(champions[0]?.sub14Champion).toBe('Campeón Joven');
    expect(champions[1]?.year).toBe(2026);
    expect(champions[1]?.seniorChampion).toBe('Juan Pedro González (Jeipi)');
  });

  it('caps the progressive list to at most the 3 most recent years (rolling window 2029+)', async () => {
    const { createAdminClient } = await import('@/lib/supabase/server');
    (createAdminClient as any).mockReturnValue({
      from: () => ({
        select: () => ({
          in: () => ({
            order: async () => ({
              data: [
                {
                  id: 't-2030',
                  name: 'Senior CD 2030',
                  category: 'plus14',
                  status: 'finished',
                  created_at: '2030-08-15T00:00:00Z',
                  matches: [{ stage: 'final', status: 'completed', winner_id: 'p1', player1_id: 'p1', player1: { name: 'Champ 2030' } }],
                },
                {
                  id: 't-2029',
                  name: 'Senior CD 2029',
                  category: 'plus14',
                  status: 'finished',
                  created_at: '2029-08-15T00:00:00Z',
                  matches: [{ stage: 'final', status: 'completed', winner_id: 'p1', player1_id: 'p1', player1: { name: 'Champ 2029' } }],
                },
                {
                  id: 't-2028',
                  name: 'Senior CD 2028',
                  category: 'plus14',
                  status: 'finished',
                  created_at: '2028-08-15T00:00:00Z',
                  matches: [{ stage: 'final', status: 'completed', winner_id: 'p1', player1_id: 'p1', player1: { name: 'Champ 2028' } }],
                },
                {
                  id: 't-2027',
                  name: 'Senior CD 2027',
                  category: 'plus14',
                  status: 'finished',
                  created_at: '2027-08-15T00:00:00Z',
                  matches: [{ stage: 'final', status: 'completed', winner_id: 'p1', player1_id: 'p1', player1: { name: 'Champ 2027' } }],
                },
              ],
            }),
          }),
        }),
      }),
    });

    const champions = await getRecentChampions();
    // Maximum 3 items
    expect(champions).toHaveLength(3);
    expect(champions.map((c) => c.year)).toEqual([2030, 2029, 2028]);
  });
});
