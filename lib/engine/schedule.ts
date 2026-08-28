/** A match pairing between two players */
export interface MatchPairing {
  player1Id: string;
  player2Id: string;
}

/**
 * Calculate expected number of matches for a round-robin group.
 * Formula: N × (N - 1) / 2
 */
export function calculateExpectedMatches(groupSize: number): number {
  if (groupSize < 2) return 0;
  return (groupSize * (groupSize - 1)) / 2;
}

/**
 * Generate all round-robin match pairings for a group.
 * Every player plays every other player exactly once.
 * No duplicate matches, no self-matches.
 * 
 * @param playerIds Array of player IDs in the group
 * @returns Array of match pairings
 */
export function generateRoundRobin(playerIds: string[]): MatchPairing[] {
  if (playerIds.length < 2) return [];

  const pairings: MatchPairing[] = [];

  for (let i = 0; i < playerIds.length; i++) {
    for (let j = i + 1; j < playerIds.length; j++) {
      const p1 = playerIds[i];
      const p2 = playerIds[j];
      if (!p1 || !p2) throw new Error(`Missing player ID at index ${i} or ${j}`);
      pairings.push({
        player1Id: p1,
        player2Id: p2,
      });
    }
  }

  return pairings;
}

/**
 * Validate a schedule for completeness and correctness.
 * Checks:
 * - No duplicate matches
 * - No self-matches
 * - Every pair plays exactly once
 * - Correct total count
 */
export function validateSchedule(
  matches: MatchPairing[],
  playerIds: string[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const expected = calculateExpectedMatches(playerIds.length);

  // Check total count
  if (matches.length !== expected) {
    errors.push(`Expected ${expected} matches, got ${matches.length}`);
  }

  // Check for self-matches
  for (const match of matches) {
    if (match.player1Id === match.player2Id) {
      errors.push(`Self-match found: ${match.player1Id}`);
    }
  }

  // Check for duplicates (order-independent)
  const seen = new Set<string>();
  for (const match of matches) {
    const key = [match.player1Id, match.player2Id].sort().join('-');
    if (seen.has(key)) {
      errors.push(`Duplicate match: ${key}`);
    }
    seen.add(key);
  }

  // Check completeness: every pair must exist
  for (let i = 0; i < playerIds.length; i++) {
    for (let j = i + 1; j < playerIds.length; j++) {
      const p1 = playerIds[i];
      const p2 = playerIds[j];
      if (!p1 || !p2) continue;
      const key = [p1, p2].sort().join('-');
      if (!seen.has(key)) {
        errors.push(`Missing match: ${p1} vs ${p2}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Calculate group progress as a fraction.
 */
export function calculateGroupProgress(
  confirmedMatches: number,
  expectedMatches: number
): { confirmed: number; expected: number; percentage: number } {
  if (expectedMatches === 0) return { confirmed: 0, expected: 0, percentage: 100 };
  return {
    confirmed: confirmedMatches,
    expected: expectedMatches,
    percentage: Math.round((confirmedMatches / expectedMatches) * 100),
  };
}
