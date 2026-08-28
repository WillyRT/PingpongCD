import { describe, it, expect } from 'vitest';
import {
  calculateWinProbability,
  evaluateExpectedScore,
  adjustVolatilityForUpset,
} from '../../lib/engine/analytics';

describe('Predictive Analytics & Bradley-Terry Model', () => {
  it('should return 50%-50% for players with identical ratings', () => {
    const res = calculateWinProbability(1500, 1500);
    expect(res.p1).toBe(0.5);
    expect(res.p2).toBe(0.5);
    expect(res.percentage1).toBe(50);
    expect(res.percentage2).toBe(50);
    expect(res.badgeP1).toBe('50%');
    expect(res.badgeP2).toBe('50%');
  });

  it('should calculate accurate win probability for rating difference', () => {
    // A 200-point difference gives ~76% win probability to the higher rated player
    const res = calculateWinProbability(1700, 1500);
    expect(res.p1).toBeGreaterThan(0.74);
    expect(res.p1).toBeLessThan(0.78);
    expect(res.p2).toBeLessThan(0.26);
    expect(res.percentage1 + res.percentage2).toBe(100);
  });

  it('should detect upsets when underdog with P < 25% wins', () => {
    // r1: 1400, r2: 1700 -> p1 is ~0.15 (< 0.25)
    // If player 1 wins 7-5, it is an upset!
    const res = evaluateExpectedScore(1400, 1700, 7, 5, 7);
    expect(res.isUpset).toBe(true);
    expect(res.upsetBadge).toBe('Sorpresa de la jornada');
    expect(res.performanceDelta).toBeGreaterThan(0);
  });

  it('should NOT flag normal win as upset when favorite wins', () => {
    // Favorite with r1=1700, r2=1400 wins 7-2
    const res = evaluateExpectedScore(1700, 1400, 7, 2, 7);
    expect(res.isUpset).toBe(false);
    expect(res.upsetBadge).toBeUndefined();
  });

  it('should boost volatility on upset to accelerate rating convergence', () => {
    const initialVol = 0.06;
    const adjusted = adjustVolatilityForUpset(initialVol);
    expect(adjusted).toBeGreaterThan(initialVol);
    expect(adjusted).toBeCloseTo(0.072, 3);
  });
});
