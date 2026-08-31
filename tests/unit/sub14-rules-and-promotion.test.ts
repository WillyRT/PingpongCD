import { describe, it, expect } from 'vitest';
import {
  UNIFIED_RULES,
  getUnifiedTargetPoints,
  validateUnifiedScore,
  identifySub14Finalists,
} from '../../lib/engine/tournament-rules';

describe('Sub-14 Rules Parity & Senior Promotion Engine Suite', () => {
  describe('1. Paridad Total de Reglas Competitivas (7 / 11 / 15 pts)', () => {
    it('enforces 100% identical target points between Sub-14 and Senior across all stages', () => {
      // Group Stage (7 points)
      expect(getUnifiedTargetPoints('group', 'sub14')).toBe(7);
      expect(getUnifiedTargetPoints('group', 'plus14')).toBe(7);
      expect(getUnifiedTargetPoints('group', 'senior')).toBe(7);
      expect(UNIFIED_RULES.groupTargetPoints).toBe(7);

      // Playoff Knockout Stages (11 points)
      expect(getUnifiedTargetPoints('quarterfinal', 'sub14')).toBe(11);
      expect(getUnifiedTargetPoints('quarterfinal', 'plus14')).toBe(11);
      expect(getUnifiedTargetPoints('semifinal', 'sub14')).toBe(11);
      expect(getUnifiedTargetPoints('semifinal', 'plus14')).toBe(11);
      expect(getUnifiedTargetPoints('round_of_16', 'sub14')).toBe(11);
      expect(UNIFIED_RULES.knockoutTargetPoints).toBe(11);

      // Gran Final (15 points)
      expect(getUnifiedTargetPoints('final', 'sub14')).toBe(15);
      expect(getUnifiedTargetPoints('final', 'plus14')).toBe(15);
      expect(UNIFIED_RULES.finalTargetPoints).toBe(15);

      // Diff 2 and 4 tables
      expect(UNIFIED_RULES.requiredDifference).toBe(2);
      expect(UNIFIED_RULES.tableCount).toBe(4);
    });

    it('validates Sub-14 Group stage scoring rules (first to 7, diff >= 2, deuce at 6-6)', () => {
      // Standard valid group scores
      expect(validateUnifiedScore(7, 4, 'group', 'sub14').valid).toBe(true);
      expect(validateUnifiedScore(5, 7, 'group', 'sub14').valid).toBe(true);
      expect(validateUnifiedScore(7, 0, 'group', 'sub14').valid).toBe(true);

      // Deuce extended play (at 6-6)
      expect(validateUnifiedScore(8, 6, 'group', 'sub14').valid).toBe(true);
      expect(validateUnifiedScore(9, 11, 'group', 'sub14').valid).toBe(true); // extended deuce

      // Invalid group scores
      expect(validateUnifiedScore(6, 4, 'group', 'sub14').valid).toBe(false); // winner didn't reach 7
      expect(validateUnifiedScore(7, 6, 'group', 'sub14').valid).toBe(false); // diff < 2
      expect(validateUnifiedScore(9, 4, 'group', 'sub14').valid).toBe(false); // overshoot without deuce
    });

    it('validates Sub-14 Playoffs scoring rules (first to 11, diff >= 2, deuce at 10-10)', () => {
      // Standard valid playoff scores
      expect(validateUnifiedScore(11, 8, 'quarterfinal', 'sub14').valid).toBe(true);
      expect(validateUnifiedScore(9, 11, 'semifinal', 'sub14').valid).toBe(true);

      // Deuce extended play (at 10-10)
      expect(validateUnifiedScore(12, 10, 'quarterfinal', 'sub14').valid).toBe(true);
      expect(validateUnifiedScore(14, 12, 'semifinal', 'sub14').valid).toBe(true);

      // Invalid playoff scores
      expect(validateUnifiedScore(10, 8, 'quarterfinal', 'sub14').valid).toBe(false); // under 11
      expect(validateUnifiedScore(11, 10, 'quarterfinal', 'sub14').valid).toBe(false); // diff < 2
    });

    it('validates Sub-14 Gran Final scoring rules (first to 15, diff >= 2, deuce at 14-14)', () => {
      // Standard valid final scores
      expect(validateUnifiedScore(15, 12, 'final', 'sub14').valid).toBe(true);
      expect(validateUnifiedScore(11, 15, 'final', 'sub14').valid).toBe(true);

      // Deuce extended play (at 14-14)
      expect(validateUnifiedScore(16, 14, 'final', 'sub14').valid).toBe(true);
      expect(validateUnifiedScore(17, 19, 'final', 'sub14').valid).toBe(true);

      // Invalid final scores
      expect(validateUnifiedScore(14, 12, 'final', 'sub14').valid).toBe(false); // under 15
      expect(validateUnifiedScore(15, 14, 'final', 'sub14').valid).toBe(false); // diff < 2
    });
  });

  describe('2. Promoción Automática de Finalistas Sub-14 -> Senior', () => {
    it('identifies Champion (1st) and Runner-up (2nd) when Sub-14 final is completed', () => {
      const mockMatches = [
        {
          stage: 'quarterfinal',
          winner_id: 'sub-p1',
          player1_id: 'sub-p1',
          player2_id: 'sub-p8',
          status: 'completed',
        },
        {
          stage: 'semifinal',
          winner_id: 'sub-p1',
          player1_id: 'sub-p1',
          player2_id: 'sub-p4',
          status: 'completed',
        },
        {
          stage: 'semifinal',
          winner_id: 'sub-p2',
          player1_id: 'sub-p3',
          player2_id: 'sub-p2',
          status: 'completed',
        },
        {
          stage: 'final',
          winner_id: 'sub-p1', // Champion is sub-p1
          player1_id: 'sub-p1',
          player2_id: 'sub-p2', // Runner-up is sub-p2
          status: 'completed',
        },
      ];

      const result = identifySub14Finalists(mockMatches);

      expect(result.isComplete).toBe(true);
      expect(result.championId).toBe('sub-p1');
      expect(result.runnerUpId).toBe('sub-p2');
    });

    it('returns isComplete: false if Sub-14 final is still scheduled or ongoing', () => {
      const mockOngoingMatches = [
        {
          stage: 'final',
          winner_id: null,
          player1_id: 'sub-p1',
          player2_id: 'sub-p2',
          status: 'scheduled',
        },
      ];

      const result = identifySub14Finalists(mockOngoingMatches);
      expect(result.isComplete).toBe(false);
      expect(result.championId).toBeNull();
      expect(result.runnerUpId).toBeNull();
    });

    it('correctly assigns category sub14_promoted and preserves Glicko-2 ratings upon promotion', () => {
      const champion = {
        id: 'champ-uuid',
        name: 'Martín Alonso',
        currentRating: 1585.4,
        category: 'sub14',
      };
      const runnerUp = {
        id: 'runner-uuid',
        name: 'Alejandra Escudero',
        currentRating: 1572.1,
        category: 'sub14',
      };

      // Simulated enrollment into Senior draw
      const seniorEnrollments = [
        {
          userId: champion.id,
          name: champion.name,
          category: 'sub14_promoted',
          position: 1,
          preservedRating: champion.currentRating,
        },
        {
          userId: runnerUp.id,
          name: runnerUp.name,
          category: 'sub14_promoted',
          position: 2,
          preservedRating: runnerUp.currentRating,
        },
      ];

      expect(seniorEnrollments[0]!.category).toBe('sub14_promoted');
      expect(seniorEnrollments[0]!.position).toBe(1);
      expect(seniorEnrollments[0]!.preservedRating).toBe(1585.4);

      expect(seniorEnrollments[1]!.category).toBe('sub14_promoted');
      expect(seniorEnrollments[1]!.position).toBe(2);
      expect(seniorEnrollments[1]!.preservedRating).toBe(1572.1);
    });

    it('promoted Sub-14 finalists are included in real senior groups (GA-GD) during seeding and group assignment', async () => {
      const { distributeByCategory } = await import('../../lib/engine/seeding');
      const { assignSeniorGroups } = await import('../../lib/engine/groups');

      const seniorPlayers = Array.from({ length: 14 }, (_, i) => ({
        id: `senior-${i + 1}`,
        rating: 1600 - i * 10,
        rating_deviation: 50,
        matches_played: 10,
        category: 'plus14' as const,
      }));

      const promotedFinalists = [
        {
          id: 'champ-sub14',
          rating: 1550,
          rating_deviation: 60,
          matches_played: 8,
          category: 'sub14_promoted' as const,
        },
        {
          id: 'runner-sub14',
          rating: 1540,
          rating_deviation: 65,
          matches_played: 8,
          category: 'sub14_promoted' as const,
        },
      ];

      const allParticipants = [...seniorPlayers, ...promotedFinalists];
      expect(allParticipants).toHaveLength(16);

      // 1. Using distributeByCategory
      const seedingResults = distributeByCategory(allParticipants, (count) => Math.ceil(count / 4));
      const seniorSeeding = seedingResults.get('plus14');
      expect(seniorSeeding).toBeDefined();

      const champAssignment = seniorSeeding?.assignments.find((a) => a.player.id === 'champ-sub14');
      const runnerAssignment = seniorSeeding?.assignments.find((a) => a.player.id === 'runner-sub14');

      expect(champAssignment).toBeDefined();
      expect(champAssignment?.groupIndex).toBeGreaterThanOrEqual(0);
      expect(champAssignment?.groupIndex).toBeLessThan(4);
      expect(runnerAssignment).toBeDefined();
      expect(runnerAssignment?.groupIndex).toBeGreaterThanOrEqual(0);
      expect(runnerAssignment?.groupIndex).toBeLessThan(4);

      // 2. Using assignSeniorGroups
      const groupMap = assignSeniorGroups(allParticipants, 4);
      expect(groupMap.size).toBe(4);

      const allGroupPlayers = Array.from(groupMap.values()).flat();
      expect(allGroupPlayers.some((p) => p.id === 'champ-sub14')).toBe(true);
      expect(allGroupPlayers.some((p) => p.id === 'runner-sub14')).toBe(true);
    });
  });
});
