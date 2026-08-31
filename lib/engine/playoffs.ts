import {
  calculateBracketSize,
  determineRoundName,
  advanceWinner,
  type Bracket,
  type BracketMatch,
  type QualifiedPlayer,
} from './bracket';
import { isSeniorEligible } from './categories';
import type { AgeCategory } from '../types/domain';

/**
 * Standard seed pairings for single elimination brackets of size B (powers of 2).
 * Formatted so top seeds meet lowest possible seeds, and Byes fall to the highest seeds first.
 */
export function getStandardSeedingPairs(bracketSize: number): [number, number][] {
  if (bracketSize === 2) return [[1, 2]];
  if (bracketSize === 4) {
    return [
      [1, 4],
      [2, 3],
    ];
  }
  if (bracketSize === 8) {
    return [
      [1, 8],
      [4, 5],
      [3, 6],
      [2, 7],
    ];
  }
  if (bracketSize === 16) {
    return [
      [1, 16],
      [8, 9],
      [4, 13],
      [5, 12],
      [3, 14],
      [6, 11],
      [2, 15],
      [7, 10],
    ];
  }

  // General symmetric fallback
  const pairs: [number, number][] = [];
  const matchCount = bracketSize / 2;
  for (let i = 0; i < matchCount; i++) {
    pairs.push([i + 1, bracketSize - i]);
  }
  return pairs;
}

/**
 * Generates an official single elimination playoff bracket with automated Bye resolution.
 * If total qualifiers is 3, 5, 6, or 7 (or any non-power of 2):
 * - Adjusts bracket size to 4, 8, etc.
 * - Byes are granted exclusively to top seeds (highest coefficient from group stage).
 * - Lowest coefficient qualifiers play preliminary matches in round 1.
 * - Byes auto-advance so top seeds are already placed into the next round slots.
 */
export function generatePlayoffsWithByes(qualifiers: QualifiedPlayer[]): Bracket {
  const totalQualifiers = qualifiers.length;
  if (totalQualifiers < 2) {
    throw new Error('Need at least 2 qualifiers to generate a playoff bracket');
  }

  // Sort qualifiers by seed ascending (Seed 1 is best)
  const sorted = [...qualifiers].sort((a, b) => a.seed - b.seed);

  const bracketSize = calculateBracketSize(totalQualifiers);
  const totalRounds = Math.log2(bracketSize);
  const matches: BracketMatch[] = [];
  let matchCounter = 0;

  // 1. Build bracket structure & match linkage grid
  const matchGrid: string[][] = [];
  for (let round = 1; round <= totalRounds; round++) {
    const matchesInRound = bracketSize / Math.pow(2, round);
    const roundMatches: string[] = [];
    for (let pos = 0; pos < matchesInRound; pos++) {
      matchCounter++;
      roundMatches.push(`playoff-${matchCounter}`);
    }
    matchGrid.push(roundMatches);
  }

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
        nextSlot = pos % 2 === 0 ? 1 : 2;
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

  // 2. Map seeding pairs to first round matches
  const seedPairs = getStandardSeedingPairs(bracketSize);
  const firstRoundMatches = matches.filter((m) => m.round === 1);

  // Map seed number -> QualifiedPlayer
  const seedMap = new Map<number, QualifiedPlayer>();
  sorted.forEach((q, idx) => {
    // If seed was explicitly set, use it; otherwise 1-based index
    const seedNum = q.seed && q.seed > 0 ? q.seed : idx + 1;
    seedMap.set(seedNum, q);
  });

  for (let i = 0; i < firstRoundMatches.length; i++) {
    const match = firstRoundMatches[i];
    const pair = seedPairs[i];
    if (!match || !pair) continue;

    const [seedA, seedB] = pair;
    const playerA = seedMap.get(seedA);
    const playerB = seedMap.get(seedB);

    if (playerA && playerB) {
      // Normal match between two players
      match.player1Id = playerA.playerId;
      match.player2Id = playerB.playerId;
      match.isBye = false;
    } else if (playerA && !playerB) {
      // Player A gets a Bye!
      match.player1Id = playerA.playerId;
      match.player2Id = null;
      match.isBye = true;
      match.winnerId = playerA.playerId;
    } else if (!playerA && playerB) {
      // Player B gets a Bye!
      match.player1Id = playerB.playerId;
      match.player2Id = null;
      match.isBye = true;
      match.winnerId = playerB.playerId;
    } else {
      // Empty bye
      match.isBye = true;
    }
  }

  // 3. Auto-advance Byes to the next round
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

/** Filter playoff qualifiers who are eligible for the senior category */
export function filterSeniorPlayoffQualifiers<T extends { category?: AgeCategory | string | null }>(qualifiers: T[]): T[] {
  return qualifiers.filter((q) => isSeniorEligible(q.category));
}
