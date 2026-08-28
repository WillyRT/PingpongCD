import { describe, it, expect } from 'vitest';
import {
  calculateGroupCount,
  calculateGroupSizes,
  validateGroupDistribution,
  getGroupLabel,
} from '../../lib/engine/groups';

describe('Groups Engine', () => {
  describe('calculateGroupCount', () => {
    it.each([
      [4, 1], [5, 1], [6, 1], [7, 1],
      [8, 2], [9, 2], [10, 2], [11, 2],
      [12, 3], [13, 3], [14, 3], [15, 3],
      [16, 4], [17, 4], [24, 4], [50, 4], [100, 4],
    ])('should return %i groups for %i players', (players, expected) => {
      expect(calculateGroupCount(players)).toBe(expected);
    });

    it('should throw for less than 4 players', () => {
      expect(() => calculateGroupCount(3)).toThrow();
      expect(() => calculateGroupCount(0)).toThrow();
    });
  });

  describe('calculateGroupSizes', () => {
    it('should distribute 24 players into 4 groups of 6', () => {
      expect(calculateGroupSizes(24, 4)).toEqual([6, 6, 6, 6]);
    });

    it('should distribute 23 players as [6,6,6,5]', () => {
      expect(calculateGroupSizes(23, 4)).toEqual([6, 6, 6, 5]);
    });

    it('should distribute 25 players as [7,6,6,6]', () => {
      expect(calculateGroupSizes(25, 4)).toEqual([7, 6, 6, 6]);
    });

    it('should handle single group', () => {
      expect(calculateGroupSizes(5, 1)).toEqual([5]);
    });

    it('should handle 2 groups unevenly', () => {
      expect(calculateGroupSizes(9, 2)).toEqual([5, 4]);
    });

    it('should throw if more groups than players', () => {
      expect(() => calculateGroupSizes(2, 4)).toThrow();
    });
  });

  describe('validateGroupDistribution', () => {
    it('should accept balanced groups', () => {
      expect(validateGroupDistribution([6, 6, 6, 6])).toBe(true);
      expect(validateGroupDistribution([6, 6, 6, 5])).toBe(true);
    });

    it('should reject unbalanced groups', () => {
      expect(validateGroupDistribution([7, 7, 5, 5])).toBe(false);
    });

    it('should reject empty input', () => {
      expect(validateGroupDistribution([])).toBe(false);
    });
  });

  describe('getGroupLabel', () => {
    it.each([
      [0, 'A'], [1, 'B'], [2, 'C'], [3, 'D'],
    ])('should return %s for index %i', (idx, label) => {
      expect(getGroupLabel(idx)).toBe(label);
    });
  });
});
