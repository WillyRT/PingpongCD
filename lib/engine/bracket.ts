/** Bracket match in the tournament */
export interface BracketMatch {
  id: string;
  round: number;
  position: number;
  player1Id: string | null;
  player2Id: string | null;
  score1: number | null;
  score2: number | null;
  winnerId: string | null;
  nextMatchId: string | null;
  nextSlot: 1 | 2 | null; // Winner goes to slot 1 or 2 of next match
  isBye: boolean;
  stage: string; // 'quarterfinal', 'semifinal', 'final', etc.
}

/** Qualified player from group stage */
export interface QualifiedPlayer {
  playerId: string;
  groupIndex: number;
  groupPosition: number; // 1st, 2nd, etc. in group
  seed: number; // Overall bracket seed
}

/** Full bracket structure */
export interface Bracket {
  matches: BracketMatch[];
  rounds: number;
  totalSlots: number;
}

/**
 * Calculate the next power of 2 >= n.
 * This determines the bracket size.
 */
export function calculateBracketSize(totalQualifiers: number): number {
  if (totalQualifiers <= 1) return 1;
  let size = 1;
  while (size < totalQualifiers) {
    size *= 2;
  }
  return size;
}

/**
 * Determine round name based on total rounds and current round.
 * Round 1 is the first round, last round is the final.
 */
export function determineRoundName(totalRounds: number, round: number): string {
  const roundsFromEnd = totalRounds - round; // 0 = final, 1 = semi, 2 = QF, etc.
  switch (roundsFromEnd) {
    case 0: return 'final';
    case 1: return 'semifinal';
    case 2: return 'quarterfinal';
    default: {
      const matchesInRound = Math.pow(2, roundsFromEnd);
      return `round_of_${matchesInRound * 2}`;
    }
  }
}

/**
 * Generate standard cross-group matchups.
 * For 4 groups with 2 qualifiers each:
 *   A1 vs B2, C1 vs D2, B1 vs A2, D1 vs C2
 * 
 * For other configurations, creates fair cross-group matchups.
 */
export function generateCrossGroupMatchups(
  qualifiers: QualifiedPlayer[],
  groupCount: number,
  qualifiersPerGroup: number
): QualifiedPlayer[][] {
  if (qualifiers.length === 0) return [];

  // Standard 4-group, 2-per-group format (Quarterfinals)
  if (groupCount === 4 && qualifiersPerGroup === 2) {
    const get = (group: number, pos: number): QualifiedPlayer | undefined =>
      qualifiers.find(q => q.groupIndex === group && q.groupPosition === pos);

    const matchups: QualifiedPlayer[][] = [];
    const a1 = get(0, 1); const b2 = get(1, 2);
    const c1 = get(2, 1); const d2 = get(3, 2);
    const b1 = get(1, 1); const a2 = get(0, 2);
    const d1 = get(3, 1); const c2 = get(2, 2);

    if (a1 && b2) matchups.push([a1, b2]);
    if (c1 && d2) matchups.push([c1, d2]);
    if (b1 && a2) matchups.push([b1, a2]);
    if (d1 && c2) matchups.push([d1, c2]);

    return matchups;
  }

  // 2-group, 2-per-group format (Semifinals: A1 vs B2, B1 vs A2)
  if (groupCount === 2 && qualifiersPerGroup === 2) {
    const get = (group: number, pos: number): QualifiedPlayer | undefined =>
      qualifiers.find(q => q.groupIndex === group && q.groupPosition === pos);

    const matchups: QualifiedPlayer[][] = [];
    const a1 = get(0, 1); const b2 = get(1, 2);
    const b1 = get(1, 1); const a2 = get(0, 2);

    if (a1 && b2) matchups.push([a1, b2]);
    if (b1 && a2) matchups.push([b1, a2]);

    return matchups;
  }

  // General case: seed-based pairing
  // Sort by overall seed, then pair 1st vs last, 2nd vs 2nd-to-last, etc.
  const sorted = [...qualifiers].sort((a, b) => a.seed - b.seed);
  const matchups: QualifiedPlayer[][] = [];
  const half = Math.ceil(sorted.length / 2);

  for (let i = 0; i < half; i++) {
    const top = sorted[i];
    const bottom = sorted[sorted.length - 1 - i];
    if (top && bottom && top !== bottom) {
      matchups.push([top, bottom]);
    } else if (top) {
      // Bye
      matchups.push([top]);
    }
  }

  return matchups;
}

import { generatePlayoffsWithByes } from './playoffs';
export { generatePlayoffsWithByes };

/**
 * Generate a complete bracket structure.
 * 
 * @param qualifiers Qualified players with group info and seeds
 * @param groupCount Number of groups
 * @param qualifiersPerGroup Qualifiers per group
 * @returns Complete bracket with all matches and byes resolved
 */
export function generateBracket(
  qualifiers: QualifiedPlayer[],
  groupCount: number,
  qualifiersPerGroup: number
): Bracket {
  const totalQualifiers = qualifiers.length;
  if (totalQualifiers < 2) {
    throw new Error('Need at least 2 qualifiers for a bracket');
  }

  // If not a power of 2 or uneven qualifiers (3, 5, 6, 7), use playoffs with Byes
  const bracketSize = calculateBracketSize(totalQualifiers);
  if (
    totalQualifiers !== bracketSize ||
    !(
      (groupCount === 4 && qualifiersPerGroup === 2 && totalQualifiers === 8) ||
      (groupCount === 2 && qualifiersPerGroup === 2 && totalQualifiers === 4)
    )
  ) {
    return generatePlayoffsWithByes(qualifiers);
  }

  const totalRounds = Math.log2(bracketSize);
  const matches: BracketMatch[] = [];
  let matchCounter = 0;

  // Generate match IDs for all rounds
  const matchGrid: string[][] = [];
  for (let round = 1; round <= totalRounds; round++) {
    const matchesInRound = bracketSize / Math.pow(2, round);
    const roundMatches: string[] = [];
    for (let pos = 0; pos < matchesInRound; pos++) {
      matchCounter++;
      roundMatches.push(`bracket-${matchCounter}`);
    }
    matchGrid.push(roundMatches);
  }

  // Create match objects with linkage
  for (let roundIdx = 0; roundIdx < matchGrid.length; roundIdx++) {
    const roundMatches = matchGrid[roundIdx];
    if (!roundMatches) continue;
    const round = roundIdx + 1;
    const nextRoundMatches = matchGrid[roundIdx + 1];
    const stage = determineRoundName(totalRounds, round);

    for (let pos = 0; pos < roundMatches.length; pos++) {
      const matchId = roundMatches[pos];
      if (!matchId) continue;

      let nextMatchId: string | null = null;
      let nextSlot: 1 | 2 | null = null;

      if (nextRoundMatches) {
        const nextPos = Math.floor(pos / 2);
        nextMatchId = nextRoundMatches[nextPos] ?? null;
        nextSlot = (pos % 2 === 0) ? 1 : 2;
      }

      matches.push({
        id: matchId,
        round,
        position: pos,
        player1Id: null,
        player2Id: null,
        score1: null,
        score2: null,
        winnerId: null,
        nextMatchId,
        nextSlot,
        isBye: false,
        stage,
      });
    }
  }

  // Seed players into first round using matchups
  const matchups = generateCrossGroupMatchups(qualifiers, groupCount, qualifiersPerGroup);
  const firstRoundMatches = matches.filter(m => m.round === 1);

  for (let i = 0; i < matchups.length; i++) {
    const matchup = matchups[i];
    const match = firstRoundMatches[i];
    if (!matchup || !match) continue;

    if (matchup.length === 2) {
      match.player1Id = matchup[0]?.playerId ?? null;
      match.player2Id = matchup[1]?.playerId ?? null;
    } else if (matchup.length === 1) {
      // Bye
      match.player1Id = matchup[0]?.playerId ?? null;
      match.player2Id = null;
      match.isBye = true;
      match.winnerId = matchup[0]?.playerId ?? null;
    }
  }

  // Handle remaining first round matches that have no matchup (byes)
  for (const match of firstRoundMatches) {
    if (match.player1Id === null && match.player2Id === null) {
      match.isBye = true;
    }
  }

  // Auto-advance byes
  for (const match of matches) {
    if (match.isBye && match.winnerId && match.nextMatchId) {
      advanceWinner(matches, match.id, match.winnerId);
    }
  }

  return {
    matches,
    rounds: totalRounds,
    totalSlots: bracketSize,
  };
}

/**
 * Advance a winner to their next bracket match.
 * Idempotent: if the winner is already placed, does nothing.
 */
export function advanceWinner(
  matches: BracketMatch[],
  currentMatchId: string,
  winnerId: string
): boolean {
  const currentMatch = matches.find(m => m.id === currentMatchId);
  if (!currentMatch || !currentMatch.nextMatchId) return false;

  const nextMatch = matches.find(m => m.id === currentMatch.nextMatchId);
  if (!nextMatch) return false;

  if (currentMatch.nextSlot === 1) {
    if (nextMatch.player1Id === winnerId) return true; // Already placed
    nextMatch.player1Id = winnerId;
  } else if (currentMatch.nextSlot === 2) {
    if (nextMatch.player2Id === winnerId) return true; // Already placed
    nextMatch.player2Id = winnerId;
  }

  return true;
}

/**
 * Validate that a qualifier configuration produces a valid bracket.
 * Requirements:
 * - Total qualifiers >= 2
 * - qualifiersPerGroup * groupCount should be reasonable
 */
export function validateBracketConfig(
  groupCount: number,
  qualifiersPerGroup: number,
  groupSizes: number[]
): { valid: boolean; totalQualifiers: number; bracketSize: number; errors: string[] } {
  const errors: string[] = [];
  const totalQualifiers = groupCount * qualifiersPerGroup;

  if (totalQualifiers < 2) {
    errors.push('Need at least 2 total qualifiers for a bracket');
  }

  // Check each group has enough players
  for (let i = 0; i < groupSizes.length; i++) {
    const size = groupSizes[i];
    if (size !== undefined && qualifiersPerGroup > size) {
      errors.push(`Group ${String.fromCharCode(65 + i)} has ${size} players but ${qualifiersPerGroup} qualifiers requested`);
    }
  }

  const bracketSize = calculateBracketSize(totalQualifiers);

  return {
    valid: errors.length === 0,
    totalQualifiers,
    bracketSize,
    errors,
  };
}
