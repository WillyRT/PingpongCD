import { describe, it, expect } from 'vitest';
import {
  generateRoundRobin,
  calculateExpectedMatches,
  validateSchedule,
  calculateGroupProgress,
} from '../../lib/engine/schedule';

describe('Schedule Engine', () => {
  describe('calculateExpectedMatches', () => {
    it.each([
      [2, 1], [3, 3], [4, 6], [5, 10], [6, 15], [7, 21], [8, 28],
    ])('should return %i matches for %i players', (players, expected) => {
      expect(calculateExpectedMatches(players)).toBe(expected);
    });
  });

  describe('generateRoundRobin', () => {
    it('should generate correct number of matches', () => {
      for (const n of [4, 5, 6, 7, 8]) {
        const ids = Array.from({ length: n }, (_, i) => `p${i}`);
        const matches = generateRoundRobin(ids);
        expect(matches.length).toBe(calculateExpectedMatches(n));
      }
    });

    it('should not contain self-matches', () => {
      const ids = ['a', 'b', 'c', 'd', 'e'];
      const matches = generateRoundRobin(ids);
      for (const m of matches) {
        expect(m.player1Id).not.toBe(m.player2Id);
      }
    });

    it('should not contain duplicates', () => {
      const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
      const matches = generateRoundRobin(ids);
      const keys = matches.map(m => [m.player1Id, m.player2Id].sort().join('-'));
      expect(new Set(keys).size).toBe(keys.length);
    });
  });

  describe('validateSchedule', () => {
    it('should validate a correct schedule', () => {
      const ids = ['a', 'b', 'c', 'd'];
      const matches = generateRoundRobin(ids);
      const result = validateSchedule(matches, ids);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing matches', () => {
      const ids = ['a', 'b', 'c'];
      const matches = generateRoundRobin(ids).slice(0, 2); // Remove one
      const result = validateSchedule(matches, ids);
      expect(result.valid).toBe(false);
    });
  });

  describe('calculateGroupProgress', () => {
    it('should calculate percentage correctly', () => {
      const progress = calculateGroupProgress(13, 15);
      expect(progress.percentage).toBe(87);
    });

    it('should return 100% for complete group', () => {
      const progress = calculateGroupProgress(15, 15);
      expect(progress.percentage).toBe(100);
    });
  });
});
