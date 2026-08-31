import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isSeniorEligible } from '@/lib/engine/categories';
import { distributeByCategory, type SeedablePlayer } from '@/lib/engine/seeding';
import { assignSeniorGroups, filterSeniorGroupPlayers } from '@/lib/engine/groups';
import { identifySub14Finalists } from '@/lib/engine/tournament-rules';
import { promoteSub14FinalistsAction, generateGroupsAndScheduleAction } from '@/lib/actions/tournament';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('Integration Test: Sub-14 Promotion & Senior Draw Seeding (tests/integration/sub14-promotion-seeding.test.ts)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Senior Eligibility Domain Helper', () => {
    it('validates senior eligibility: plus14 and sub14_promoted are true, sub14 is false', () => {
      expect(isSeniorEligible('plus14')).toBe(true);
      expect(isSeniorEligible('sub14_promoted')).toBe(true);
      expect(isSeniorEligible('sub14')).toBe(false);
      expect(isSeniorEligible(null)).toBe(false);
      expect(isSeniorEligible(undefined)).toBe(false);
      expect(isSeniorEligible('other')).toBe(false);
    });

    it('filters senior eligible players for groups GA-GD including sub14_promoted', () => {
      const players = [
        { id: 'p1', name: 'Adulto 1', category: 'plus14' },
        { id: 'p2', name: 'Adulto 2', category: 'plus14' },
        { id: 'p-sub', name: 'Junior', category: 'sub14' },
        { id: 'p-promoted1', name: 'Campeon Sub-14 Promovido', category: 'sub14_promoted' },
        { id: 'p-promoted2', name: 'Subcampeon Sub-14 Promovido', category: 'sub14_promoted' },
      ];

      const seniorEligible = filterSeniorGroupPlayers(players);
      expect(seniorEligible.map((p) => p.id)).toEqual(['p1', 'p2', 'p-promoted1', 'p-promoted2']);
    });
  });

  describe('2. Engine Seeding & Group Assignment (GA-GD) for Promoted Finalists', () => {
    it('distributeByCategory places sub14_promoted players into the senior draw (GA-GD) with real seeds', () => {
      const seedablePlayers: SeedablePlayer[] = [
        { id: 's-1', rating: 1900, rating_deviation: 80, matches_played: 20, category: 'plus14' },
        { id: 's-2', rating: 1850, rating_deviation: 80, matches_played: 18, category: 'plus14' },
        { id: 's-3', rating: 1800, rating_deviation: 80, matches_played: 15, category: 'plus14' },
        { id: 's-4', rating: 1750, rating_deviation: 80, matches_played: 14, category: 'plus14' },
        { id: 's-5', rating: 1700, rating_deviation: 80, matches_played: 12, category: 'plus14' },
        { id: 's-6', rating: 1650, rating_deviation: 80, matches_played: 10, category: 'plus14' },
        { id: 'champ-sub14', rating: 1620, rating_deviation: 75, matches_played: 25, category: 'sub14_promoted' },
        { id: 's-7', rating: 1600, rating_deviation: 80, matches_played: 10, category: 'plus14' },
        { id: 's-8', rating: 1550, rating_deviation: 80, matches_played: 10, category: 'plus14' },
        { id: 'runner-sub14', rating: 1520, rating_deviation: 70, matches_played: 22, category: 'sub14_promoted' },
        { id: 's-9', rating: 1500, rating_deviation: 80, matches_played: 8, category: 'plus14' },
        { id: 's-10', rating: 1450, rating_deviation: 80, matches_played: 6, category: 'plus14' },
        { id: 's-11', rating: 1400, rating_deviation: 80, matches_played: 5, category: 'plus14' },
        { id: 's-12', rating: 1350, rating_deviation: 80, matches_played: 5, category: 'plus14' },
        { id: 's-13', rating: 1300, rating_deviation: 80, matches_played: 5, category: 'plus14' },
        { id: 's-14', rating: 1250, rating_deviation: 80, matches_played: 5, category: 'plus14' },
      ];

      const results = distributeByCategory(seedablePlayers, () => 4);
      const seniorResult = results.get('plus14');

      expect(seniorResult).toBeDefined();
      expect(seniorResult?.assignments).toHaveLength(16);

      const champAssignment = seniorResult?.assignments.find((a) => a.player.id === 'champ-sub14');
      const runnerAssignment = seniorResult?.assignments.find((a) => a.player.id === 'runner-sub14');

      expect(champAssignment).toBeDefined();
      expect(champAssignment?.seed).toBe(7);
      expect(champAssignment?.groupIndex).toBeGreaterThanOrEqual(0);
      expect(champAssignment?.groupIndex).toBeLessThanOrEqual(3);

      expect(runnerAssignment).toBeDefined();
      expect(runnerAssignment?.seed).toBe(10);
      expect(runnerAssignment?.groupIndex).toBeGreaterThanOrEqual(0);
      expect(runnerAssignment?.groupIndex).toBeLessThanOrEqual(3);

      const groups = assignSeniorGroups(seedablePlayers, 4);
      expect(groups.get('A')?.length).toBe(4);
      expect(groups.get('B')?.length).toBe(4);
      expect(groups.get('C')?.length).toBe(4);
      expect(groups.get('D')?.length).toBe(4);
    });
  });

  describe('3. End-to-End Server Action Flow: Promotion to Real Senior Draw', () => {
    it('promotes Sub-14 finalists and assigns them real groups upon running generateGroupsAndScheduleAction', async () => {
      const { createClient, createAdminClient } = await import('@/lib/supabase/server');

      const sub14TournamentId = 'sub14-tourney-100';
      const seniorTournamentId = 'senior-tourney-200';

      const mockSub14Matches = [
        {
          id: 'sub-final-match',
          tournament_id: sub14TournamentId,
          stage: 'final',
          player1_id: 'sub14-p1',
          player2_id: 'sub14-p2',
          score_player1: 15,
          score_player2: 13,
          winner_id: 'sub14-p1',
          status: 'completed',
        },
      ];

      const finalistsCheck = identifySub14Finalists(mockSub14Matches);
      expect(finalistsCheck.isComplete).toBe(true);
      expect(finalistsCheck.championId).toBe('sub14-p1');
      expect(finalistsCheck.runnerUpId).toBe('sub14-p2');

      const participantsStore: Array<{
        tournament_id: string;
        user_id: string;
        category: string;
        group_id: string | null;
        seed_number: number | null;
        profiles?: { rating: number; rating_deviation: number; matches_played: number };
      }> = [
        ...Array.from({ length: 14 }, (_, i) => ({
          tournament_id: seniorTournamentId,
          user_id: `senior-player-${i + 1}`,
          category: 'plus14',
          group_id: null,
          seed_number: null,
          profiles: { rating: 1600 - i * 20, rating_deviation: 80, matches_played: 10 },
        })),
      ];

      const groupsStore: Array<{ id: string; tournament_id: string; category: string; group_code: string; status: string }> = [];
      const matchesStore: any[] = [];

      (createAdminClient as any).mockReturnValue({
        from: (table: string) => {
          if (table === 'matches') {
            return {
              select: () => ({
                eq: (col: string, val: string) => {
                  if (col === 'tournament_id' && val === sub14TournamentId) {
                    return Promise.resolve({ data: mockSub14Matches, error: null });
                  }
                  return Promise.resolve({ data: [], error: null });
                },
              }),
            };
          }
          if (table === 'profiles') {
            return {
              select: () => ({
                in: async () => ({
                  data: [
                    { id: 'sub14-p1', name: 'Lucas Campeon', nickname: 'Lucas', rating: 1590 },
                    { id: 'sub14-p2', name: 'Sofia Subcampeona', nickname: 'Sofia', rating: 1530 },
                  ],
                  error: null,
                }),
              }),
            };
          }
          if (table === 'tournaments') {
            return {
              select: () => ({
                eq: () => ({
                  single: async () => ({
                    data: { id: seniorTournamentId, name: 'Torneo Absoluta Oficial', slug: 'torneo-absoluta-oficial' },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === 'tournament_participants') {
            return {
              upsert: async (record: any) => {
                const existing = participantsStore.find((p) => p.user_id === record.user_id && p.tournament_id === record.tournament_id);
                if (existing) {
                  existing.category = record.category;
                } else {
                  participantsStore.push({
                    ...record,
                    group_id: null,
                    seed_number: null,
                    profiles: record.user_id === 'sub14-p1'
                      ? { rating: 1590, rating_deviation: 75, matches_played: 15 }
                      : { rating: 1530, rating_deviation: 70, matches_played: 12 },
                  });
                }
                return { data: record, error: null };
              },
            };
          }
          return { select: vi.fn(), insert: vi.fn() };
        },
      });

      const promoteRes = await promoteSub14FinalistsAction(sub14TournamentId, seniorTournamentId);
      expect(promoteRes.success).toBe(true);
      expect(promoteRes.data?.promoted).toHaveLength(2);
      expect(promoteRes.data?.promoted[0]?.playerId).toBe('sub14-p1');
      expect(promoteRes.data?.promoted[1]?.playerId).toBe('sub14-p2');

      const promotedEnrolled = participantsStore.filter((p) => p.category === 'sub14_promoted');
      expect(promotedEnrolled).toHaveLength(2);
      expect(participantsStore).toHaveLength(16);

      (createClient as any).mockReturnValue({
        auth: {
          getUser: async () => ({ data: { user: { id: 'admin-user-1' } } }),
        },
        from: (table: string) => {
          if (table === 'tournament_participants') {
            return {
              select: () => ({
                eq: () => ({
                  in: (col2: string, vals: string[]) => ({
                    data: participantsStore.filter((p) => vals.includes(p.category)),
                    error: null,
                  }),
                  data: participantsStore,
                  error: null,
                }),
              }),
              update: (updateData: any) => ({
                eq: (col1: string, tId: string) => ({
                  eq: (col2: string, uId: string) => {
                    const found = participantsStore.find((p) => p.tournament_id === tId && p.user_id === uId);
                    if (found) {
                      Object.assign(found, updateData);
                    }
                    return Promise.resolve({ data: found, error: null });
                  },
                }),
              }),
            };
          }
          if (table === 'tournament_groups') {
            return {
              upsert: (record: any) => {
                const groupObj = { ...record, id: 'group-' + record.group_code.toLowerCase() };
                groupsStore.push(groupObj);
                return {
                  select: () => ({
                    single: async () => ({ data: groupObj, error: null }),
                  }),
                };
              },
            };
          }
          if (table === 'matches') {
            return {
              delete: () => ({
                eq: () => ({
                  eq: () => ({
                    eq: () => Promise.resolve({ error: null }),
                  }),
                }),
              }),
              insert: async (matchData: any) => {
                matchesStore.push(matchData);
                return { data: matchData, error: null };
              },
            };
          }
          if (table === 'tournaments') {
            return {
              update: () => ({
                eq: () => Promise.resolve({ error: null }),
              }),
            };
          }
          return { select: vi.fn(), insert: vi.fn(), update: vi.fn() };
        },
      });

      const scheduleRes = await generateGroupsAndScheduleAction(seniorTournamentId, 'plus14');
      expect(scheduleRes.success).toBe(true);

      const champ = participantsStore.find((p) => p.user_id === 'sub14-p1');
      const runner = participantsStore.find((p) => p.user_id === 'sub14-p2');

      expect(champ?.group_id).toBeTruthy();
      expect(champ?.group_id).toMatch(/^group-[a-d]$/);
      expect(champ?.seed_number).toBeGreaterThanOrEqual(1);
      expect(champ?.seed_number).toBeLessThanOrEqual(16);

      expect(runner?.group_id).toBeTruthy();
      expect(runner?.group_id).toMatch(/^group-[a-d]$/);
      expect(runner?.seed_number).toBeGreaterThanOrEqual(1);
      expect(runner?.seed_number).toBeLessThanOrEqual(16);

      const champMatches = matchesStore.filter(
        (m) => m.player1_id === 'sub14-p1' || m.player2_id === 'sub14-p1'
      );
      expect(champMatches.length).toBeGreaterThan(0);
      expect(champMatches[0]?.group_id).toBe(champ?.group_id);

      const runnerMatches = matchesStore.filter(
        (m) => m.player1_id === 'sub14-p2' || m.player2_id === 'sub14-p2'
      );
      expect(runnerMatches.length).toBeGreaterThan(0);
      expect(runnerMatches[0]?.group_id).toBe(runner?.group_id);
    });
  });
});
