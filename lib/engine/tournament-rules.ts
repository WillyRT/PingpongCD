/**
 * Unified Tournament Rules & Parity Engine
 * Enforces identical competitive scoring rules (7/11/15) for both Sub-14 and Senior (+14) categories,
 * 4 physical table stations mapping, and automatic promotion of Sub-14 finalists to the Senior draw.
 */

import {
  GROUP_TARGET,
  KNOCKOUT_TARGET,
  FINAL_TARGET,
  REQUIRED_DIFFERENCE,
  getTargetPointsForStage,
  type MatchStage,
} from './constants';
import { validateTableTennisScore, type ScoreValidationResult } from './scoring';

export const UNIFIED_RULES = {
  groupTargetPoints: GROUP_TARGET, // 7 pts, deuce at 6-6, min diff 2
  knockoutTargetPoints: KNOCKOUT_TARGET, // 11 pts, deuce at 10-10, min diff 2
  finalTargetPoints: FINAL_TARGET, // 15 pts, deuce at 14-14, min diff 2
  requiredDifference: REQUIRED_DIFFERENCE, // 2 pts
  tableCount: 4, // 4 physical tables
  parityCategories: ['sub14', 'sub16', 'plus14', 'senior'] as const,
};

/**
 * Returns the exact target points for any stage and category.
 * Sub-14 and Senior (+14) share 100% rule parity.
 */
export function getUnifiedTargetPoints(
  stage: MatchStage | string,
  _category?: string
): number {
  switch (stage) {
    case 'group':
      return GROUP_TARGET; // 7
    case 'final':
      return FINAL_TARGET; // 15
    default:
      return KNOCKOUT_TARGET; // 11 for round_of_16, quarterfinal, semifinal
  }
}

/**
 * Validates a table tennis score ensuring exact parity rules for both Sub-14 and Senior.
 */
export function validateUnifiedScore(
  score1: number,
  score2: number,
  stage: MatchStage | string,
  category?: string
): ScoreValidationResult {
  const target = getUnifiedTargetPoints(stage, category);
  return validateTableTennisScore(score1, score2, target);
}

export interface Sub14FinalistsResult {
  championId: string | null;
  runnerUpId: string | null;
  isComplete: boolean;
}

/**
 * Identifies the Champion (1st) and Runner-up (2nd) from the Sub-14 tournament matches.
 */
export function identifySub14Finalists(
  matches: Array<{
    stage: string;
    winner_id?: string | null;
    player1_id: string;
    player2_id: string;
    status: string;
  }>
): Sub14FinalistsResult {
  const finalMatch = matches.find((m) => m.stage === 'final');

  if (!finalMatch) {
    return { championId: null, runnerUpId: null, isComplete: false };
  }

  const isComplete =
    finalMatch.status === 'completed' || finalMatch.status === 'confirmed';

  if (!isComplete || !finalMatch.winner_id) {
    return { championId: null, runnerUpId: null, isComplete: false };
  }

  const championId = finalMatch.winner_id;
  const runnerUpId =
    finalMatch.player1_id === championId
      ? finalMatch.player2_id
      : finalMatch.player1_id;

  return {
    championId,
    runnerUpId,
    isComplete: true,
  };
}
