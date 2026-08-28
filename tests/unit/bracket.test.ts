import { describe, it, expect } from 'vitest';
import {
  calculateBracketSize,
  determineRoundName,
  generateCrossGroupMatchups,
  generateBracket,
  advanceWinner,
  validateBracketConfig,
  type QualifiedPlayer,
} from '../../lib/engine/bracket';

describe('Bracket Engine', () => {
  describe('calculateBracketSize', () => {
    it.each([
      [2, 2],
      [3, 4],
      [4, 4],
      [5, 8],
      [8, 8],
      [9, 16],
      [16, 16],
      [17, 32],
    ])('should return %i bracket size for %i qualifiers', (qualifiers, expectedSize) => {
      expect(calculateBracketSize(qualifiers)).toBe(expectedSize);
    });
  });

  describe('determineRoundName', () => {
    it('should name rounds appropriately based on distance from final', () => {
      expect(determineRoundName(3, 3)).toBe('final');
      expect(determineRoundName(3, 2)).toBe('semifinal');
      expect(determineRoundName(3, 1)).toBe('quarterfinal');
      expect(determineRoundName(4, 1)).toBe('round_of_16');
    });
  });

  describe('generateCrossGroupMatchups (4 groups, 2 qualifiers)', () => {
    it('should generate official matchups A1vB2, C1vD2, B1vA2, D1vC2 per spec §16', () => {
      const qualifiers: QualifiedPlayer[] = [
        { playerId: 'a1', groupIndex: 0, groupPosition: 1, seed: 1 },
        { playerId: 'a2', groupIndex: 0, groupPosition: 2, seed: 8 },
        { playerId: 'b1', groupIndex: 1, groupPosition: 1, seed: 2 },
        { playerId: 'b2', groupIndex: 1, groupPosition: 2, seed: 7 },
        { playerId: 'c1', groupIndex: 2, groupPosition: 1, seed: 3 },
        { playerId: 'c2', groupIndex: 2, groupPosition: 2, seed: 6 },
        { playerId: 'd1', groupIndex: 3, groupPosition: 1, seed: 4 },
        { playerId: 'd2', groupIndex: 3, groupPosition: 2, seed: 5 },
      ];

      const matchups = generateCrossGroupMatchups(qualifiers, 4, 2);

      expect(matchups.length).toBe(4);
      // QF1: A1 vs B2
      expect(matchups[0]?.map(p => p.playerId)).toEqual(['a1', 'b2']);
      // QF2: C1 vs D2
      expect(matchups[1]?.map(p => p.playerId)).toEqual(['c1', 'd2']);
      // QF3: B1 vs A2
      expect(matchups[2]?.map(p => p.playerId)).toEqual(['b1', 'a2']);
      // QF4: D1 vs C2
      expect(matchups[3]?.map(p => p.playerId)).toEqual(['d1', 'c2']);
    });
  });

  describe('generateBracket', () => {
    it('should generate a complete 8-player bracket with 3 rounds (QF, SF, Final)', () => {
      const qualifiers: QualifiedPlayer[] = [
        { playerId: 'a1', groupIndex: 0, groupPosition: 1, seed: 1 },
        { playerId: 'a2', groupIndex: 0, groupPosition: 2, seed: 8 },
        { playerId: 'b1', groupIndex: 1, groupPosition: 1, seed: 2 },
        { playerId: 'b2', groupIndex: 1, groupPosition: 2, seed: 7 },
        { playerId: 'c1', groupIndex: 2, groupPosition: 1, seed: 3 },
        { playerId: 'c2', groupIndex: 2, groupPosition: 2, seed: 6 },
        { playerId: 'd1', groupIndex: 3, groupPosition: 1, seed: 4 },
        { playerId: 'd2', groupIndex: 3, groupPosition: 2, seed: 5 },
      ];

      const bracket = generateBracket(qualifiers, 4, 2);

      expect(bracket.rounds).toBe(3);
      expect(bracket.totalSlots).toBe(8);
      // 4 QF + 2 SF + 1 Final = 7 matches
      expect(bracket.matches.length).toBe(7);

      const qfMatches = bracket.matches.filter(m => m.round === 1);
      expect(qfMatches.length).toBe(4);
      expect(qfMatches.every(m => m.stage === 'quarterfinal')).toBe(true);

      const sfMatches = bracket.matches.filter(m => m.round === 2);
      expect(sfMatches.length).toBe(2);
      expect(sfMatches.every(m => m.stage === 'semifinal')).toBe(true);

      const finalMatch = bracket.matches.find(m => m.round === 3);
      expect(finalMatch?.stage).toBe('final');
    });

    it('should handle byes properly when total qualifiers is not a power of 2', () => {
      // 6 qualifiers -> 8-bracket with 2 byes
      const qualifiers: QualifiedPlayer[] = [
        { playerId: 'p1', groupIndex: 0, groupPosition: 1, seed: 1 },
        { playerId: 'p2', groupIndex: 1, groupPosition: 1, seed: 2 },
        { playerId: 'p3', groupIndex: 2, groupPosition: 1, seed: 3 },
        { playerId: 'p4', groupIndex: 0, groupPosition: 2, seed: 4 },
        { playerId: 'p5', groupIndex: 1, groupPosition: 2, seed: 5 },
        { playerId: 'p6', groupIndex: 2, groupPosition: 2, seed: 6 },
      ];

      const bracket = generateBracket(qualifiers, 3, 2);
      expect(bracket.totalSlots).toBe(8);
      expect(bracket.matches.length).toBe(7);
    });
  });

  describe('advanceWinner', () => {
    it('should advance winner to the next round slot correctly', () => {
      const qualifiers: QualifiedPlayer[] = [
        { playerId: 'a1', groupIndex: 0, groupPosition: 1, seed: 1 },
        { playerId: 'a2', groupIndex: 0, groupPosition: 2, seed: 8 },
        { playerId: 'b1', groupIndex: 1, groupPosition: 1, seed: 2 },
        { playerId: 'b2', groupIndex: 1, groupPosition: 2, seed: 7 },
        { playerId: 'c1', groupIndex: 2, groupPosition: 1, seed: 3 },
        { playerId: 'c2', groupIndex: 2, groupPosition: 2, seed: 6 },
        { playerId: 'd1', groupIndex: 3, groupPosition: 1, seed: 4 },
        { playerId: 'd2', groupIndex: 3, groupPosition: 2, seed: 5 },
      ];

      const bracket = generateBracket(qualifiers, 4, 2);
      const firstQF = bracket.matches.find(m => m.round === 1 && m.position === 0)!;

      expect(firstQF.nextMatchId).toBeDefined();

      const advanced = advanceWinner(bracket.matches, firstQF.id, 'a1');
      expect(advanced).toBe(true);

      const sfMatch = bracket.matches.find(m => m.id === firstQF.nextMatchId)!;
      expect(sfMatch.player1Id).toBe('a1');
    });
  });

  describe('validateBracketConfig', () => {
    it('should validate viable qualifier configurations', () => {
      const result = validateBracketConfig(4, 2, [6, 6, 6, 6]);
      expect(result.valid).toBe(true);
      expect(result.totalQualifiers).toBe(8);
    });

    it('should reject when qualifiers exceed group size', () => {
      const result = validateBracketConfig(4, 7, [6, 6, 6, 6]);
      expect(result.valid).toBe(false);
    });
  });
});
