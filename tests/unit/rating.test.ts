import { describe, it, expect } from 'vitest';
import {
  initialRating,
  updateRating,
  updateRatingsForMatch,
  calculateExpectedScore,
  type PlayerRating,
} from '../../lib/engine/rating';
import { DEFAULT_RATING, DEFAULT_RATING_DEVIATION, DEFAULT_VOLATILITY } from '../../lib/engine/constants';

describe('Rating Engine (Glicko-2)', () => {
  describe('initialRating', () => {
    it('should return standard initial rating values', () => {
      const init = initialRating();
      expect(init.rating).toBe(DEFAULT_RATING); // 1500
      expect(init.ratingDeviation).toBe(DEFAULT_RATING_DEVIATION); // 350
      expect(init.volatility).toBe(DEFAULT_VOLATILITY); // 0.06
      expect(init.matchesPlayed).toBe(0);
    });
  });

  describe('updateRatingsForMatch', () => {
    it('should increase winner rating and decrease loser rating', () => {
      const p1 = initialRating();
      const p2 = initialRating();

      const [updatedWinner, updatedLoser] = updateRatingsForMatch(p1, p2);

      expect(updatedWinner.rating).toBeGreaterThan(1500);
      expect(updatedLoser.rating).toBeLessThan(1500);
      expect(updatedWinner.ratingDeviation).toBeLessThan(350);
      expect(updatedLoser.ratingDeviation).toBeLessThan(350);
      expect(updatedWinner.matchesPlayed).toBe(1);
      expect(updatedLoser.matchesPlayed).toBe(1);
    });

    it('should result in smaller rating gain when beating a much lower rated player', () => {
      const highRated: PlayerRating = { rating: 1900, ratingDeviation: 80, volatility: 0.06, matchesPlayed: 20 };
      const lowRated: PlayerRating = { rating: 1300, ratingDeviation: 80, volatility: 0.06, matchesPlayed: 20 };

      const [updatedHigh, updatedLow] = updateRatingsForMatch(highRated, lowRated);

      const highGain = updatedHigh.rating - highRated.rating;
      expect(highGain).toBeGreaterThan(0);
      expect(highGain).toBeLessThan(10); // Minimal gain for expected victory
    });

    it('should result in large rating gain when an underdog wins', () => {
      const underdog: PlayerRating = { rating: 1300, ratingDeviation: 150, volatility: 0.06, matchesPlayed: 10 };
      const favorite: PlayerRating = { rating: 1800, ratingDeviation: 80, volatility: 0.06, matchesPlayed: 30 };

      const [updatedUnderdog] = updateRatingsForMatch(underdog, favorite);

      const underdogGain = updatedUnderdog.rating - underdog.rating;
      expect(underdogGain).toBeGreaterThan(50); // Significant gain for upset
    });
  });

  describe('calculateExpectedScore', () => {
    it('should return 0.5 for equally rated players', () => {
      const p1 = initialRating();
      const p2 = initialRating();
      expect(calculateExpectedScore(p1, p2)).toBeCloseTo(0.5, 2);
    });

    it('should return > 0.5 for higher rated player', () => {
      const p1: PlayerRating = { rating: 1700, ratingDeviation: 100, volatility: 0.06, matchesPlayed: 10 };
      const p2: PlayerRating = { rating: 1400, ratingDeviation: 100, volatility: 0.06, matchesPlayed: 10 };
      expect(calculateExpectedScore(p1, p2)).toBeGreaterThan(0.7);
    });
  });

  describe('Glickman Official Paper Benchmark Example', () => {
    it('should match the exact values from Mark Glickman example paper', () => {
      // Primary player: r = 1500, RD = 200, sigma = 0.06
      const player: PlayerRating = {
        rating: 1500,
        ratingDeviation: 200,
        volatility: 0.06,
        matchesPlayed: 0,
      };

      // 3 matches in the rating period
      // Match 1: opponent r = 1400, RD = 30, result = 1 (win)
      // Match 2: opponent r = 1550, RD = 100, result = 0 (loss)
      // Match 3: opponent r = 1700, RD = 300, result = 0 (loss)
      const results = [
        { opponent: { rating: 1400, ratingDeviation: 30, volatility: 0.06, matchesPlayed: 0 }, score: 1 as const },
        { opponent: { rating: 1550, ratingDeviation: 100, volatility: 0.06, matchesPlayed: 0 }, score: 0 as const },
        { opponent: { rating: 1700, ratingDeviation: 300, volatility: 0.06, matchesPlayed: 0 }, score: 0 as const },
      ];

      const updated = updateRating(player, results);

      // Glickman paper reference:
      // r' = 1464.06 (rounds to 1464.1)
      // RD' = 151.52 (rounds to 151.5)
      // sigma' = 0.05999 (rounds to 0.059990)
      expect(Math.round(updated.rating)).toBe(1464);
      expect(Math.abs(updated.rating - 1464.06)).toBeLessThan(0.2);
      expect(Math.abs(updated.ratingDeviation - 151.52)).toBeLessThan(0.2);
      expect(updated.volatility).toBeCloseTo(0.05999, 4);
    });
  });
});
