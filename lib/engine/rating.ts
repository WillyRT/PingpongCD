import {
  DEFAULT_RATING,
  DEFAULT_RATING_DEVIATION,
  DEFAULT_VOLATILITY,
  GLICKO2_TAU,
  GLICKO2_EPSILON,
  GLICKO2_SCALE,
} from './constants';

/** Player rating data */
export interface PlayerRating {
  rating: number;
  ratingDeviation: number;
  volatility: number;
  matchesPlayed: number;
}

/** Match result for rating calculation */
export interface RatingMatchResult {
  opponent: PlayerRating;
  score: 1 | 0; // 1 = win, 0 = loss (no draws in table tennis)
}

/** Return the default initial rating */
export function initialRating(): PlayerRating {
  return {
    rating: DEFAULT_RATING,
    ratingDeviation: DEFAULT_RATING_DEVIATION,
    volatility: DEFAULT_VOLATILITY,
    matchesPlayed: 0,
  };
}

/** Glicko-2 g function: reduces impact of uncertain opponents */
function g(phi: number): number {
  return 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
}

/** Glicko-2 E function: expected score */
function E(mu: number, muJ: number, phiJ: number): number {
  return 1 / (1 + Math.exp(-g(phiJ) * (mu - muJ)));
}

/**
 * Update a player's Glicko-2 rating after a rating period (one or more matches).
 * Full Glicko-2 algorithm with Illinois method for volatility.
 */
export function updateRating(
  player: PlayerRating,
  results: RatingMatchResult[]
): PlayerRating {
  const mu = (player.rating - DEFAULT_RATING) / GLICKO2_SCALE;
  const phi = player.ratingDeviation / GLICKO2_SCALE;
  const sigma = player.volatility;

  // No matches: only RD increases
  if (results.length === 0) {
    const phiPrime = Math.sqrt(phi * phi + sigma * sigma);
    return {
      rating: player.rating,
      ratingDeviation: Math.round(phiPrime * GLICKO2_SCALE * 10) / 10,
      volatility: sigma,
      matchesPlayed: player.matchesPlayed,
    };
  }

  // Step 1: Compute variance v and delta
  let vInv = 0;
  let deltaSum = 0;

  for (const result of results) {
    const muJ = (result.opponent.rating - DEFAULT_RATING) / GLICKO2_SCALE;
    const phiJ = result.opponent.ratingDeviation / GLICKO2_SCALE;
    const gPhiJ = g(phiJ);
    const expScore = E(mu, muJ, phiJ);

    vInv += gPhiJ * gPhiJ * expScore * (1 - expScore);
    deltaSum += gPhiJ * (result.score - expScore);
  }

  const v = 1 / vInv;
  const delta = v * deltaSum;

  // Step 2: Compute new volatility (Illinois algorithm)
  const a = Math.log(sigma * sigma);

  const f = (x: number): number => {
    const ex = Math.exp(x);
    const num = ex * (delta * delta - phi * phi - v - ex);
    const den = 2 * Math.pow(phi * phi + v + ex, 2);
    return num / den - (x - a) / (GLICKO2_TAU * GLICKO2_TAU);
  };

  let A = a;
  let B: number;

  if (delta * delta > phi * phi + v) {
    B = Math.log(delta * delta - phi * phi - v);
  } else {
    let k = 1;
    while (f(a - k * GLICKO2_TAU) < 0) {
      k++;
    }
    B = a - k * GLICKO2_TAU;
  }

  let fA = f(A);
  let fB = f(B);

  while (Math.abs(B - A) > GLICKO2_EPSILON) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);

    if (fC * fB < 0) {
      A = B;
      fA = fB;
    } else {
      fA /= 2;
    }

    B = C;
    fB = fC;
  }

  const sigmaPrime = Math.exp(A / 2);

  // Step 3: New RD and rating
  const phiStar = Math.sqrt(phi * phi + sigmaPrime * sigmaPrime);
  const phiPrime = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const muPrime = mu + phiPrime * phiPrime * deltaSum;

  return {
    rating: Math.round((muPrime * GLICKO2_SCALE + DEFAULT_RATING) * 10) / 10,
    ratingDeviation: Math.round(phiPrime * GLICKO2_SCALE * 10) / 10,
    volatility: Number(sigmaPrime.toFixed(6)),
    matchesPlayed: player.matchesPlayed + results.length,
  };
}

/**
 * Convenience: Update ratings for a single match between two players.
 * Returns [updatedWinner, updatedLoser].
 */
export function updateRatingsForMatch(
  winner: PlayerRating,
  loser: PlayerRating
): [PlayerRating, PlayerRating] {
  const updatedWinner = updateRating(winner, [
    { opponent: loser, score: 1 },
  ]);
  const updatedLoser = updateRating(loser, [
    { opponent: winner, score: 0 },
  ]);
  return [updatedWinner, updatedLoser];
}

/**
 * Calculate expected outcome probability between two players.
 */
export function calculateExpectedScore(
  player: PlayerRating,
  opponent: PlayerRating
): number {
  const mu = (player.rating - DEFAULT_RATING) / GLICKO2_SCALE;
  const muJ = (opponent.rating - DEFAULT_RATING) / GLICKO2_SCALE;
  const phiJ = opponent.ratingDeviation / GLICKO2_SCALE;
  return E(mu, muJ, phiJ);
}

export const FALLBACK_MIN_ELO = 1100;
export const FALLBACK_MAX_ELO = 2050;

/**
 * Calculate initial provisional rating from a self-declared level (0.0 to 10.0).
 * Uses minElo and maxElo from existing rating distribution (fallbacks 1100 and 2050).
 * Initial RD = 350.0, Volatility = 0.06.
 */
export function calculateProvisionalRating(
  declaredLevel: number,
  minElo: number = FALLBACK_MIN_ELO,
  maxElo: number = FALLBACK_MAX_ELO
): PlayerRating {
  const clamped = Math.max(0, Math.min(10, declaredLevel));
  const rating = minElo + (clamped / 10) * (maxElo - minElo);

  return {
    rating: Math.round(rating * 10) / 10,
    ratingDeviation: DEFAULT_RATING_DEVIATION,
    volatility: DEFAULT_VOLATILITY,
    matchesPlayed: 0,
  };
}

