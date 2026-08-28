import { describe, it, expect } from 'vitest';
import {
  validateTableTennisScore,
  validateGroupScore,
  validateKnockoutScore,
  validateFinalScore,
  validateScoreForStage,
  determineWinner,
} from '../../lib/engine/scoring';

describe('Scoring Engine', () => {
  describe('validateGroupScore (target 7)', () => {
    // Valid scores
    it.each([
      [7, 0], [7, 1], [7, 2], [7, 3], [7, 4], [7, 5],
      [8, 6], [9, 7], [10, 8],
    ])('should accept valid score %i-%i', (s1, s2) => {
      expect(validateGroupScore(s1, s2).valid).toBe(true);
    });

    // Also valid reversed
    it.each([
      [0, 7], [1, 7], [5, 7], [6, 8], [7, 9],
    ])('should accept valid reversed score %i-%i', (s1, s2) => {
      expect(validateGroupScore(s1, s2).valid).toBe(true);
    });

    // Invalid scores
    it.each([
      [7, 6], [8, 7], [9, 8], [10, 9],
      [6, 0], [6, 5], // below target
      [7, 7], // draw
      [-1, 7], // negative
    ])('should reject invalid score %i-%i', (s1, s2) => {
      expect(validateGroupScore(s1, s2).valid).toBe(false);
    });

    // Impossible scores (winner overshot without deuce)
    it.each([
      [9, 4], [10, 3], [8, 2],
    ])('should reject impossible score %i-%i (no deuce scenario)', (s1, s2) => {
      expect(validateGroupScore(s1, s2).valid).toBe(false);
    });
  });

  describe('validateKnockoutScore (target 11)', () => {
    it.each([
      [11, 0], [11, 9], [12, 10], [13, 11], [14, 12],
    ])('should accept valid score %i-%i', (s1, s2) => {
      expect(validateKnockoutScore(s1, s2).valid).toBe(true);
    });

    it.each([
      [11, 10], [12, 11], [13, 12],
      [10, 0],
    ])('should reject invalid score %i-%i', (s1, s2) => {
      expect(validateKnockoutScore(s1, s2).valid).toBe(false);
    });
  });

  describe('validateFinalScore (target 15)', () => {
    it.each([
      [15, 0], [15, 13], [16, 14], [17, 15], [18, 16],
    ])('should accept valid score %i-%i', (s1, s2) => {
      expect(validateFinalScore(s1, s2).valid).toBe(true);
    });

    it.each([
      [15, 14], [16, 15], [17, 16],
      [14, 0],
    ])('should reject invalid score %i-%i', (s1, s2) => {
      expect(validateFinalScore(s1, s2).valid).toBe(false);
    });
  });

  describe('determineWinner', () => {
    it('should return 1 when player1 scores higher', () => {
      expect(determineWinner(7, 3)).toBe(1);
    });
    it('should return 2 when player2 scores higher', () => {
      expect(determineWinner(3, 7)).toBe(2);
    });
  });

  describe('validateScoreForStage', () => {
    it('should use target 7 for group stage', () => {
      expect(validateScoreForStage(7, 5, 'group').valid).toBe(true);
      expect(validateScoreForStage(6, 4, 'group').valid).toBe(false);
      expect(validateScoreForStage(11, 0, 'group').valid).toBe(false);
    });
    it('should use target 11 for quarterfinal', () => {
      expect(validateScoreForStage(11, 9, 'quarterfinal').valid).toBe(true);
    });
    it('should use target 11 for semifinal', () => {
      expect(validateScoreForStage(11, 5, 'semifinal').valid).toBe(true);
    });
    it('should use target 15 for final', () => {
      expect(validateScoreForStage(15, 10, 'final').valid).toBe(true);
    });
  });

  describe('winnerId in validation result', () => {
    it('should return winnerId=1 when player1 wins', () => {
      const result = validateGroupScore(7, 3);
      expect(result.valid).toBe(true);
      expect(result.winnerId).toBe(1);
    });
    it('should return winnerId=2 when player2 wins', () => {
      const result = validateGroupScore(5, 7);
      expect(result.valid).toBe(true);
      expect(result.winnerId).toBe(2);
    });
    it('should return winnerId=null for invalid scores', () => {
      const result = validateGroupScore(7, 6);
      expect(result.valid).toBe(false);
      expect(result.winnerId).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should reject non-integer scores', () => {
      expect(validateGroupScore(7.5, 3).valid).toBe(false);
    });
    it('should reject negative scores', () => {
      expect(validateGroupScore(-1, 7).valid).toBe(false);
    });
  });
});
