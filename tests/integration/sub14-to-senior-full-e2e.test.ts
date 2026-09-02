import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateScoreForStage } from '@/lib/engine/scoring';
import { calculateStandings, resolveMiniLeague, type ConfirmedMatch } from '@/lib/engine/standings';
import { generatePlayoffsWithByes } from '@/lib/engine/playoffs';
import { isSeniorEligible } from '@/lib/engine/categories';
import { distributeByCategory, snakeDistributeWithCBI, assignSeeds, type SeedablePlayer } from '@/lib/engine/seeding';
import { assignSeniorGroups } from '@/lib/engine/groups';
import { dispatchStationTables, type TableMatch, type GroupEntry } from '@/lib/engine/tables';
import { canTransition } from '@/lib/engine/tournament-state';
import { promoteSub14FinalistsAction } from '@/lib/actions/tournament';

// Mock Supabase and Next.js cache for Server Action tests
vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('PARTE 2: Suite de Simulación E2E del Torneo Completo (tests/integration/sub14-to-senior-full-e2e.test.ts)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. TORNEO SUB-14: FASE DE GRUPOS A 7 PUNTOS
  // =========================================================================
  describe('1. Torneo Sub-14 (Fase de Grupos a 7 Puntos)', () => {
    const groupAPlayers = ['s14-a1', 's14-a2', 's14-a3', 's14-a4'];
    const groupBPlayers = ['s14-b1', 's14-b2', 's14-b3', 's14-b4'];

    const seedsA = new Map([
      ['s14-a1', 1],
      ['s14-a2', 2],
      ['s14-a3', 3],
      ['s14-a4', 4],
    ]);

    const initialRatingsA = new Map([
      ['s14-a1', 1400],
      ['s14-a2', 1350],
      ['s14-a3', 1300],
      ['s14-a4', 1250],
    ]);

    it('simula los 12 partidos con tanteos oficiales a 7 puntos y resuelve empates con resolveMiniLeague', () => {
      // 6 matches in Group A: Triple tie among a1, a2, a3 with 2 wins each, all beat a4
      const groupAMatches: ConfirmedMatch[] = [
        { player1Id: 's14-a1', player2Id: 's14-a2', score1: 7, score2: 5, winnerId: 's14-a1' },
        { player1Id: 's14-a2', player2Id: 's14-a3', score1: 7, score2: 4, winnerId: 's14-a2' },
        { player1Id: 's14-a1', player2Id: 's14-a3', score1: 6, score2: 8, winnerId: 's14-a3' },
        { player1Id: 's14-a1', player2Id: 's14-a4', score1: 7, score2: 2, winnerId: 's14-a1' },
        { player1Id: 's14-a2', player2Id: 's14-a4', score1: 7, score2: 3, winnerId: 's14-a2' },
        { player1Id: 's14-a3', player2Id: 's14-a4', score1: 7, score2: 1, winnerId: 's14-a3' },
      ];

      // Verify each score adheres strictly to the 7-point group stage rules
      for (const m of groupAMatches) {
        const val = validateScoreForStage(m.score1, m.score2, 'group');
        expect(val.valid).toBe(true);
      }

      // Group B matches: clear dominance by b1 (3 wins) and b2 (2 wins)
      const groupBMatches: ConfirmedMatch[] = [
        { player1Id: 's14-b1', player2Id: 's14-b2', score1: 7, score2: 4, winnerId: 's14-b1' },
        { player1Id: 's14-b1', player2Id: 's14-b3', score1: 7, score2: 3, winnerId: 's14-b1' },
        { player1Id: 's14-b1', player2Id: 's14-b4', score1: 7, score2: 2, winnerId: 's14-b1' },
        { player1Id: 's14-b2', player2Id: 's14-b3', score1: 7, score2: 5, winnerId: 's14-b2' },
        { player1Id: 's14-b2', player2Id: 's14-b4', score1: 8, score2: 6, winnerId: 's14-b2' },
        { player1Id: 's14-b3', player2Id: 's14-b4', score1: 7, score2: 4, winnerId: 's14-b3' },
      ];

      for (const m of groupBMatches) {
        expect(validateScoreForStage(m.score1, m.score2, 'group').valid).toBe(true);
      }

      // Total of 12 matches simulated
      expect(groupAMatches.length + groupBMatches.length).toBe(12);

      // Compute Group A Standings with 5-tier tiebreaker
      const standingsA = calculateStandings(
        groupAPlayers,
        groupAMatches,
        seedsA,
        initialRatingsA
      );

      expect(standingsA).toHaveLength(4);
      // a1, a2, a3 all have 2 wins
      expect(standingsA[0]?.wins).toBe(2);
      expect(standingsA[1]?.wins).toBe(2);
      expect(standingsA[2]?.wins).toBe(2);
      expect(standingsA[3]?.wins).toBe(0);
      expect(standingsA[3]?.playerId).toBe('s14-a4');

      // Test mini-league resolution explicitly
      const tiedEntries = standingsA.slice(0, 3);
      const miniResolved = resolveMiniLeague(
        tiedEntries,
        groupAMatches,
        seedsA,
        initialRatingsA
      );
      expect(miniResolved).toHaveLength(3);

      // Compute Group B Standings
      const seedsB = new Map([
        ['s14-b1', 1],
        ['s14-b2', 2],
        ['s14-b3', 3],
        ['s14-b4', 4],
      ]);
      const standingsB = calculateStandings(groupBPlayers, groupBMatches, seedsB);
      expect(standingsB[0]?.playerId).toBe('s14-b1');
      expect(standingsB[1]?.playerId).toBe('s14-b2');
    });
  });

  // =========================================================================
  // 2. PLAYOFFS SUB-14 Y PROMOCIÓN DE FINALISTAS
  // =========================================================================
  describe('2. Playoffs Sub-14 y Promoción de Finalistas', () => {
    it('genera semifinales a 11 puntos, final a 15 puntos y promociona a ambos finalistas', async () => {
      // 4 qualifiers: 2 from GA (a1, a2) and 2 from GB (b1, b2)
      const qualifiers = [
        { playerId: 's14-a1', seed: 1, groupIndex: 0, groupPosition: 1 },
        { playerId: 's14-b1', seed: 2, groupIndex: 1, groupPosition: 1 },
        { playerId: 's14-b2', seed: 3, groupIndex: 1, groupPosition: 2 },
        { playerId: 's14-a2', seed: 4, groupIndex: 0, groupPosition: 2 },
      ];

      const bracket = generatePlayoffsWithByes(qualifiers);
      expect(bracket.rounds).toBe(2); // Semifinals + Final
      expect(bracket.matches.length).toBe(3); // 2 SF + 1 Final

      // Semifinals to 11 points
      const sf1Score = validateScoreForStage(11, 9, 'semifinal');
      const sf2Score = validateScoreForStage(11, 7, 'semifinal');
      expect(sf1Score.valid).toBe(true);
      expect(sf2Score.valid).toBe(true);

      // Final to 15 points (official Ciudad Ducal standard)
      const finalScore = validateScoreForStage(15, 13, 'final');
      expect(finalScore.valid).toBe(true);
      expect(validateScoreForStage(14, 12, 'final').valid).toBe(false); // Must reach at least 15

      const champId = 's14-a1';
      const runnerUpId = 's14-b1';

      // Mock database setup for promoteSub14FinalistsAction
      const mockFinalMatch = {
        id: 'sub14-final-match',
        tournament_id: 'sub14-tournament-id',
        stage: 'final',
        player1_id: champId,
        player2_id: runnerUpId,
        score_player1: 15,
        score_player2: 13,
        winner_id: champId,
        status: 'completed',
      };

      const seniorParticipants: Array<{ tournament_id: string; user_id: string; category: string }> = [];

      const { createAdminClient } = await import('@/lib/supabase/server');
      vi.mocked(createAdminClient).mockReturnValue({
        from: (table: string) => {
          if (table === 'matches') {
            return {
              select: () => ({
                eq: () => Promise.resolve({ data: [mockFinalMatch], error: null }),
              }),
            };
          }
          if (table === 'profiles') {
            return {
              select: () => ({
                in: () => Promise.resolve({
                  data: [
                    { id: champId, name: 'Lucas Campeon', nickname: 'Lucas', rating: 1590 },
                    { id: runnerUpId, name: 'Sofia Subcampeona', nickname: 'Sofia', rating: 1530 },
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
                  single: () => Promise.resolve({
                    data: { id: 'senior-tournament-id', name: 'Senior Open', slug: 'senior-open' },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === 'tournament_participants') {
            return {
              upsert: vi.fn().mockImplementation((record: any) => {
                seniorParticipants.push(record);
                return Promise.resolve({ error: null });
              }),
            };
          }
          return {};
        },
      } as any);

      const promotionResult = await promoteSub14FinalistsAction(
        'sub14-tournament-id',
        'senior-tournament-id'
      );

      expect(promotionResult.success).toBe(true);
      expect(seniorParticipants).toHaveLength(2);

      const promotedChamp = seniorParticipants.find((p) => p.user_id === champId);
      const promotedRunner = seniorParticipants.find((p) => p.user_id === runnerUpId);

      expect(promotedChamp).toBeDefined();
      expect(promotedChamp?.category).toBe('sub14_promoted');
      expect(promotedRunner).toBeDefined();
      expect(promotedRunner?.category).toBe('sub14_promoted');

      // Verify domain rule isSeniorEligible returns true for both
      expect(isSeniorEligible(promotedChamp?.category)).toBe(true);
      expect(isSeniorEligible(promotedRunner?.category)).toBe(true);
      expect(isSeniorEligible('sub14')).toBe(false);
    });
  });

  // =========================================================================
  // 3. TORNEO SENIOR: SNAKE SEEDING + CBI + ASIGNACIÓN DE GRUPOS
  // =========================================================================
  describe('3. Torneo Senior (Snake Seeding + CBI + Asignación de Grupos)', () => {
    it('integra los 2 finalistas Sub-14 promovidos con 14 jugadores Senior (16 total) en 4 grupos con CBI equilibrado', () => {
      const seniorPlayers: SeedablePlayer[] = [
        { id: 'sr-1', rating: 1950, rating_deviation: 70, matches_played: 25, category: 'plus14' },
        { id: 'sr-2', rating: 1900, rating_deviation: 70, matches_played: 20, category: 'plus14' },
        { id: 'sr-3', rating: 1850, rating_deviation: 75, matches_played: 22, category: 'plus14' },
        { id: 'sr-4', rating: 1800, rating_deviation: 75, matches_played: 18, category: 'plus14' },
        { id: 'sr-5', rating: 1750, rating_deviation: 80, matches_played: 15, category: 'plus14' },
        { id: 'sr-6', rating: 1700, rating_deviation: 80, matches_played: 14, category: 'plus14' },
        { id: 's14-champ', rating: 1680, rating_deviation: 65, matches_played: 28, category: 'sub14_promoted' },
        { id: 'sr-7', rating: 1650, rating_deviation: 80, matches_played: 12, category: 'plus14' },
        { id: 'sr-8', rating: 1600, rating_deviation: 80, matches_played: 10, category: 'plus14' },
        { id: 's14-runner', rating: 1580, rating_deviation: 65, matches_played: 26, category: 'sub14_promoted' },
        { id: 'sr-9', rating: 1550, rating_deviation: 80, matches_played: 10, category: 'plus14' },
        { id: 'sr-10', rating: 1500, rating_deviation: 80, matches_played: 8, category: 'plus14' },
        { id: 'sr-11', rating: 1450, rating_deviation: 85, matches_played: 7, category: 'plus14' },
        { id: 'sr-12', rating: 1400, rating_deviation: 85, matches_played: 6, category: 'plus14' },
        { id: 'sr-13', rating: 1350, rating_deviation: 90, matches_played: 5, category: 'plus14' },
        { id: 'sr-14', rating: 1300, rating_deviation: 90, matches_played: 5, category: 'plus14' },
      ];

      expect(seniorPlayers).toHaveLength(16);

      const categoryDistribution = distributeByCategory(seniorPlayers, () => 4);
      const seniorDraw = categoryDistribution.get('plus14');

      expect(seniorDraw).toBeDefined();
      expect(seniorDraw?.assignments).toHaveLength(16);

      // Verify both promoted Sub-14 players are part of the senior draw with concrete seeds and groups
      const champAssignment = seniorDraw?.assignments.find((a) => a.player.id === 's14-champ');
      const runnerAssignment = seniorDraw?.assignments.find((a) => a.player.id === 's14-runner');

      expect(champAssignment).toBeDefined();
      expect(champAssignment?.seed).toBe(7);
      expect(champAssignment?.groupIndex).toBeGreaterThanOrEqual(0);
      expect(champAssignment?.groupIndex).toBeLessThanOrEqual(3);

      expect(runnerAssignment).toBeDefined();
      expect(runnerAssignment?.seed).toBe(10);
      expect(runnerAssignment?.groupIndex).toBeGreaterThanOrEqual(0);
      expect(runnerAssignment?.groupIndex).toBeLessThanOrEqual(3);

      // Verify Snake Distribution with CBI produces exactly 16 assignments and low CBI
      const seeded = assignSeeds(seniorPlayers);
      const cbiResult = snakeDistributeWithCBI(seeded, 4);
      expect(cbiResult.assignments).toHaveLength(16);
      expect(cbiResult.cbi.coefficientOfVariation).toBeLessThan(0.15); // Balanced draw

      const groups = assignSeniorGroups(seniorPlayers, 4);
      expect(groups.get('A')).toHaveLength(4);
      expect(groups.get('B')).toHaveLength(4);
      expect(groups.get('C')).toHaveLength(4);
      expect(groups.get('D')).toHaveLength(4);
    });
  });

  // =========================================================================
  // 4. INVARIANTE FÍSICA DE 4 MESAS (lib/engine/tables.ts)
  // =========================================================================
  describe('4. Invariante Física de 4 Mesas (lib/engine/tables.ts)', () => {
    const mockGroups: GroupEntry[] = [
      { id: 'grp-A', group_code: 'A', name: 'Grupo A' },
      { id: 'grp-B', group_code: 'B', name: 'Grupo B' },
      { id: 'grp-C', group_code: 'C', name: 'Grupo C' },
      { id: 'grp-D', group_code: 'D', name: 'Grupo D' },
    ];

    it('4 Grupos (K = 4): Mapeo fijo 1:1. Si se libera una mesa y no hay partidos de su grupo, queda libre', () => {
      // Group A has completed all matches; Groups B, C, D have pending matches
      const matches: TableMatch[] = [
        { id: 'm-b1', stage: 'group', group_id: 'grp-B', player1_id: 'pB1', player2_id: 'pB2', status: 'scheduled' },
        { id: 'm-b2', stage: 'group', group_id: 'grp-B', player1_id: 'pB3', player2_id: 'pB4', status: 'scheduled' },
        { id: 'm-c1', stage: 'group', group_id: 'grp-C', player1_id: 'pC1', player2_id: 'pC2', status: 'scheduled' },
        { id: 'm-d1', stage: 'group', group_id: 'grp-D', player1_id: 'pD1', player2_id: 'pD2', status: 'scheduled' },
      ];

      const state = dispatchStationTables({
        groups: mockGroups,
        matches,
        isPlayoffs: false,
      });

      expect(state).toHaveLength(4);

      // Table 1 (Group A) must remain available/idle even though Group B has a queued match
      const table1 = state.find((t) => t.tableNumber === 1);
      expect(table1).toBeDefined();
      expect(table1?.assignedGroup?.group_code).toBe('A');
      expect(table1?.currentMatch).toBeNull();
      expect(table1?.isIdle).toBe(true);
      expect(table1?.statusLight).toBe('green');

      // Tables 2, 3, 4 are assigned to their respective groups
      const table2 = state.find((t) => t.tableNumber === 2);
      const table3 = state.find((t) => t.tableNumber === 3);
      const table4 = state.find((t) => t.tableNumber === 4);

      expect(table2?.currentMatch?.id).toBe('m-b1');
      expect(table3?.currentMatch?.id).toBe('m-c1');
      expect(table4?.currentMatch?.id).toBe('m-d1');
    });

    it('Menos de 4 Grupos (K < 4): Activa FIFO dinámico para no dejar ninguna de las 4 mesas vacía', () => {
      const twoGroups: GroupEntry[] = [
        { id: 'grp-A', group_code: 'A', name: 'Grupo A' },
        { id: 'grp-B', group_code: 'B', name: 'Grupo B' },
      ];

      const matches: TableMatch[] = [
        { id: 'm1', stage: 'group', group_id: 'grp-A', player1_id: 'p1', player2_id: 'p2', status: 'scheduled' },
        { id: 'm2', stage: 'group', group_id: 'grp-A', player1_id: 'p3', player2_id: 'p4', status: 'scheduled' },
        { id: 'm3', stage: 'group', group_id: 'grp-B', player1_id: 'p5', player2_id: 'p6', status: 'scheduled' },
        { id: 'm4', stage: 'group', group_id: 'grp-B', player1_id: 'p7', player2_id: 'p8', status: 'scheduled' },
      ];

      const state = dispatchStationTables({
        groups: twoGroups,
        matches,
        isPlayoffs: false,
      });

      expect(state).toHaveLength(4);
      // All 4 tables are utilized in FIFO mode
      for (const t of state) {
        expect(t.currentMatch).not.toBeNull();
        expect(t.statusLight).toBe('blue');
      }
    });

    it('Playoffs: Opera como cola abierta FIFO para cualquier cruce', () => {
      const playoffMatches: TableMatch[] = [
        { id: 'qf-1', stage: 'quarterfinal', player1_id: 'p1', player2_id: 'p2', status: 'scheduled' },
        { id: 'qf-2', stage: 'quarterfinal', player1_id: 'p3', player2_id: 'p4', status: 'scheduled' },
        { id: 'qf-3', stage: 'quarterfinal', player1_id: 'p5', player2_id: 'p6', status: 'scheduled' },
        { id: 'qf-4', stage: 'quarterfinal', player1_id: 'p7', player2_id: 'p8', status: 'scheduled' },
      ];

      const state = dispatchStationTables({
        groups: [],
        matches: playoffMatches,
        isPlayoffs: true,
      });

      expect(state).toHaveLength(4);
      expect(state[0]?.currentMatch?.id).toBe('qf-1');
      expect(state[1]?.currentMatch?.id).toBe('qf-2');
      expect(state[2]?.currentMatch?.id).toBe('qf-3');
      expect(state[3]?.currentMatch?.id).toBe('qf-4');
    });

    it('Anti-colisión: Impide que el mismo jugador sea programado en dos mesas al mismo tiempo', () => {
      // p1 is playing in Table 1; p1 also has another queued match
      const conflictingMatches: TableMatch[] = [
        { id: 'm-active', stage: 'playoff', player1_id: 'player-busy', player2_id: 'p2', status: 'in_progress', table_number: 1 },
        { id: 'm-conflict', stage: 'playoff', player1_id: 'player-busy', player2_id: 'p3', status: 'scheduled' },
        { id: 'm-free', stage: 'playoff', player1_id: 'p4', player2_id: 'p5', status: 'scheduled' },
      ];

      const state = dispatchStationTables({
        groups: [],
        matches: conflictingMatches,
        isPlayoffs: true,
      });

      // Table 1 holds the active match for player-busy
      expect(state[0]?.currentMatch?.id).toBe('m-active');

      // Table 2 cannot receive m-conflict because player-busy is busy on Table 1!
      // Instead, it must dispatch m-free where both players are available
      expect(state[1]?.currentMatch?.id).toBe('m-free');
    });
  });

  // =========================================================================
  // 5. CIERRE DE TORNEO
  // =========================================================================
  describe('5. Cierre de Torneo', () => {
    it('simula las eliminatorias Senior (cuartos, semis a 11 pts y final a 15 pts) y transiciona a finished', () => {
      // Quarterfinals (11 points)
      const qfScores: [number, number][] = [
        [11, 8],
        [11, 7],
        [12, 10],
        [11, 9],
      ];
      for (const [s1, s2] of qfScores) {
        expect(validateScoreForStage(s1, s2, 'quarterfinal').valid).toBe(true);
      }

      // Semifinals (11 points)
      const sfScores: [number, number][] = [
        [11, 6],
        [11, 9],
      ];
      for (const [s1, s2] of sfScores) {
        expect(validateScoreForStage(s1, s2, 'semifinal').valid).toBe(true);
      }

      // Grand Final Senior (15 points)
      const finalScore = validateScoreForStage(15, 13, 'final');
      expect(finalScore.valid).toBe(true);

      // Validate tournament state transitions
      expect(canTransition('draft', 'registration')).toBe(true);
      expect(canTransition('registration', 'group_stage')).toBe(true);
      expect(canTransition('group_stage', 'bracket_stage')).toBe(true);
      expect(canTransition('bracket_stage', 'finished')).toBe(true);
      expect(canTransition('finished', 'group_stage')).toBe(false); // Finished is terminal
    });
  });
});
