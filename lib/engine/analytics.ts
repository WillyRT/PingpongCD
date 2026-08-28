/**
 * Predictive Analytics & Expected Score Engine (Bradley-Terry Model).
 */

export interface WinProbabilityResult {
  p1: number; // 0.0 to 1.0
  p2: number; // 0.0 to 1.0
  percentage1: number; // 0 to 100
  percentage2: number; // 0 to 100
  badgeP1: string; // e.g. "65%"
  badgeP2: string; // e.g. "35%"
}

export interface ExpectedScoreResult {
  expectedDiff: number; // expected points lead for player 1 vs player 2
  actualDiff: number; // actual score1 - score2
  performanceDelta: number; // actualDiff - expectedDiff (>0 = overperformed)
  isUpset: boolean; // Winner had < 25% win probability
  upsetBadge?: string; // "Sorpresa de la jornada"
}

/**
 * Calculate win probability between two players using the Bradley-Terry / Elo formulation:
 * P(A > B) = 1 / (1 + 10^((R_B - R_A) / 400))
 */
export function calculateWinProbability(rating1: number, rating2: number): WinProbabilityResult {
  const exponent = (rating2 - rating1) / 400;
  const p1 = 1 / (1 + Math.pow(10, exponent));
  const p2 = 1 - p1;

  const percentage1 = Math.round(p1 * 100);
  const percentage2 = Math.round(p2 * 100);

  return {
    p1: Number(p1.toFixed(4)),
    p2: Number(p2.toFixed(4)),
    percentage1,
    percentage2,
    badgeP1: `${percentage1}%`,
    badgeP2: `${percentage2}%`,
  };
}

/**
 * Compare actual match result with mathematical Bradley-Terry expectation.
 * Detects "upsets" when winner's pre-match probability was < 0.25 (25%).
 */
export function evaluateExpectedScore(
  rating1: number,
  rating2: number,
  score1: number,
  score2: number,
  targetPoints: number = 7
): ExpectedScoreResult {
  const { p1, p2 } = calculateWinProbability(rating1, rating2);

  // Expected differential scaled to target points
  const expectedDiff = Number(((p1 - p2) * targetPoints).toFixed(2));
  const actualDiff = score1 - score2;
  const performanceDelta = Number((actualDiff - expectedDiff).toFixed(2));

  // Determine if winner was an underdog with P < 0.25
  const winnerNumber = score1 > score2 ? 1 : 2;
  const winnerProbability = winnerNumber === 1 ? p1 : p2;
  const isUpset = winnerProbability < 0.25;

  return {
    expectedDiff,
    actualDiff,
    performanceDelta,
    isUpset,
    upsetBadge: isUpset ? 'Sorpresa de la jornada' : undefined,
  };
}

/**
 * Adjust player volatility when an upset occurs to accelerate rating convergence.
 */
export function adjustVolatilityForUpset(currentVolatility: number): number {
  // Increase volatility by 20%, capped at 0.09
  return Math.min(0.09, Number((currentVolatility * 1.2).toFixed(6)));
}

/**
 * Simplified Monte Carlo / heuristic playoff qualification projection
 * based on current standing, remaining matches, and player win probabilities.
 */
export interface QualifierProjection {
  playerId: string;
  qualifyProbability: number; // 0.0 to 1.0 (e.g. 0.85 = 85%)
  projectedRank: number;
}

export function projectGroupQualifiers(
  standings: Array<{ playerId: string; wins: number; played: number }>,
  totalGroupMatchesPerPlayer: number,
  qualifiersCount: number = 2
): QualifierProjection[] {
  return standings.map((s, idx) => {
    const remaining = Math.max(0, totalGroupMatchesPerPlayer - s.played);
    const winRate = s.played > 0 ? s.wins / s.played : 0.5;
    const projectedWins = s.wins + winRate * remaining;

    return {
      playerId: s.playerId,
      qualifyProbability: idx < qualifiersCount ? Math.min(0.99, 0.6 + winRate * 0.4) : Math.max(0.05, winRate * 0.4),
      projectedRank: idx + 1,
    };
  });
}
