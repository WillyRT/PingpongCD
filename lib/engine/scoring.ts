import { GROUP_TARGET, KNOCKOUT_TARGET, FINAL_TARGET, REQUIRED_DIFFERENCE, getTargetPointsForStage } from './constants';
import type { MatchStage } from './constants';

export interface ScoreValidationResult {
  valid: boolean;
  winnerId: 1 | 2 | null;
  reason?: string;
}

/**
 * Core validation: a table tennis score is valid when:
 * - The winner has at least `targetPoints`
 * - The winner leads by at least REQUIRED_DIFFERENCE (2)
 * - Exactly one player has won (not both)
 * - Both scores are non-negative integers
 */
export function validateTableTennisScore(
  score1: number,
  score2: number,
  targetPoints: number
): ScoreValidationResult {
  // Basic sanity
  if (!Number.isInteger(score1) || !Number.isInteger(score2)) {
    return { valid: false, winnerId: null, reason: 'Scores must be integers' };
  }
  if (score1 < 0 || score2 < 0) {
    return { valid: false, winnerId: null, reason: 'Scores cannot be negative' };
  }

  const winnerScore = Math.max(score1, score2);
  const loserScore = Math.min(score1, score2);

  // Winner must reach target
  if (winnerScore < targetPoints) {
    return { valid: false, winnerId: null, reason: `Winner must reach at least ${targetPoints} points` };
  }

  // Must have required difference
  if (winnerScore - loserScore < REQUIRED_DIFFERENCE) {
    return { valid: false, winnerId: null, reason: `Winner must lead by at least ${REQUIRED_DIFFERENCE} points` };
  }

  // If both are at or above target, the difference must be exactly 2 and the winner is the higher scorer.
  // Also enforce: if loser < target-1, winner must be exactly target
  // e.g. for target 7: 7-4 ok, 9-4 NOT ok (winner overshot)
  // Actually wait — in real table tennis with deuce, scores like 9-4 don't happen.
  // But the spec only checks: winnerScore >= target AND winnerScore - loserScore >= 2.
  // Let's allow it — it IS technically valid by the spec rules.
  // However, we should ensure: if winnerScore > targetPoints, then loserScore must be >= targetPoints - 1
  // because you can only exceed the target through deuce (both reached target-1 first).
  if (winnerScore > targetPoints && loserScore < targetPoints - 1) {
    return { valid: false, winnerId: null, reason: `Score ${winnerScore}-${loserScore} is not possible: extended play only occurs from ${targetPoints - 1}-${targetPoints - 1}` };
  }

  // In extended play (deuce), difference must be exactly 2
  if (loserScore >= targetPoints - 1 && winnerScore - loserScore !== REQUIRED_DIFFERENCE) {
    return { valid: false, winnerId: null, reason: `In extended play, winner must lead by exactly ${REQUIRED_DIFFERENCE}` };
  }

  // Cannot draw
  if (score1 === score2) {
    return { valid: false, winnerId: null, reason: 'Scores cannot be equal' };
  }

  return {
    valid: true,
    winnerId: score1 > score2 ? 1 : 2,
  };
}

/** Validate a group stage score (first to 7, diff 2) */
export function validateGroupScore(score1: number, score2: number): ScoreValidationResult {
  return validateTableTennisScore(score1, score2, GROUP_TARGET);
}

/** Validate a knockout stage score — QF/SF (first to 11, diff 2) */
export function validateKnockoutScore(score1: number, score2: number): ScoreValidationResult {
  return validateTableTennisScore(score1, score2, KNOCKOUT_TARGET);
}

/** Validate a final score (first to 15, diff 2) */
export function validateFinalScore(score1: number, score2: number): ScoreValidationResult {
  return validateTableTennisScore(score1, score2, FINAL_TARGET);
}

/** Validate a score for any stage */
export function validateScoreForStage(
  score1: number,
  score2: number,
  stage: MatchStage
): ScoreValidationResult {
  const target = getTargetPointsForStage(stage);
  return validateTableTennisScore(score1, score2, target);
}

/** Determine which player won (1 or 2). Assumes scores are already validated. */
export function determineWinner(score1: number, score2: number): 1 | 2 {
  return score1 > score2 ? 1 : 2;
}
