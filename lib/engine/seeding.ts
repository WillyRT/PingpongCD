import type { AgeCategory } from '../types/domain';
import { isSeniorEligible } from './categories';
import { calculateCompetitiveBalanceIndex, type CBIResult } from './cbi';

/** Minimal player interface for seeding */
export interface SeedablePlayer {
  id: string;
  rating: number;
  rating_deviation: number;
  matches_played: number;
  category?: AgeCategory;
}

/** Player with assigned seed number */
export interface SeededPlayer extends SeedablePlayer {
  seed: number;
}

/** Group assignment result */
export interface GroupAssignment {
  groupIndex: number;
  seed: number;
  player: SeedablePlayer;
}

export interface CategorySeedingResult {
  category: AgeCategory;
  assignments: GroupAssignment[];
  cbi: CBIResult;
}

/**
 * Deterministic comparison for seeding tiebreaks.
 * Order: rating DESC → rating_deviation ASC → matches_played DESC → UUID deterministic
 */
export function comparePlayers(a: SeedablePlayer, b: SeedablePlayer): number {
  if (a.rating !== b.rating) return b.rating - a.rating;
  if (a.rating_deviation !== b.rating_deviation) return a.rating_deviation - b.rating_deviation;
  if (a.matches_played !== b.matches_played) return b.matches_played - a.matches_played;
  return a.id.localeCompare(b.id);
}

/**
 * Assign seed numbers to players based on rating.
 * Seed 1 = highest rated, Seed N = lowest rated.
 */
export function assignSeeds(players: SeedablePlayer[]): SeededPlayer[] {
  const sorted = [...players].sort(comparePlayers);
  return sorted.map((player, index) => ({
    ...player,
    seed: index + 1,
  }));
}

/**
 * Distribute seeded players across groups using Snake Seeding.
 * 
 * Pattern for 4 groups:
 *   Row 1: A → B → C → D  (seeds 1,2,3,4)
 *   Row 2: D → C → B → A  (seeds 5,6,7,8)
 *   Row 3: A → B → C → D  (seeds 9,10,11,12)
 *   ...
 */
export function snakeDistribute(
  seededPlayers: SeededPlayer[],
  groupCount: number
): GroupAssignment[] {
  if (groupCount < 1) throw new Error('Need at least 1 group');
  if (seededPlayers.length === 0) return [];

  const assignments: GroupAssignment[] = [];

  for (let i = 0; i < seededPlayers.length; i++) {
    const row = Math.floor(i / groupCount);
    const posInRow = i % groupCount;

    const groupIndex = row % 2 === 0 ? posInRow : groupCount - 1 - posInRow;
    const player = seededPlayers[i];
    if (!player) throw new Error(`Missing player at index ${i}`);

    assignments.push({
      groupIndex,
      seed: player.seed,
      player,
    });
  }

  return assignments;
}

/**
 * Snake distribute and calculate Competitive Balance Index (CBI).
 */
export function snakeDistributeWithCBI(
  seededPlayers: SeededPlayer[],
  groupCount: number
): { assignments: GroupAssignment[]; cbi: CBIResult } {
  const assignments = snakeDistribute(seededPlayers, groupCount);

  // Group players by groupIndex to feed CBI
  const groups = Array.from({ length: groupCount }, (_, idx) => ({
    groupIndex: idx,
    groupCode: String.fromCharCode(65 + idx),
    players: assignments.filter((a) => a.groupIndex === idx).map((a) => ({
      id: a.player.id,
      rating: a.player.rating,
    })),
  }));

  const cbi = calculateCompetitiveBalanceIndex(groups);
  return { assignments, cbi };
}

/**
 * Distribute players across categories (Sub-14 vs Absoluta +14) independently.
 */
export function distributeByCategory(
  players: SeedablePlayer[],
  calculateGroupsForCount: (count: number) => number
): Map<AgeCategory, CategorySeedingResult> {
  const results = new Map<AgeCategory, CategorySeedingResult>();
  const categories: AgeCategory[] = ['plus14', 'sub14'];

  for (const cat of categories) {
    const catPlayers = players.filter((p) =>
      cat === 'plus14' ? isSeniorEligible(p.category) : p.category === 'sub14'
    );
    if (catPlayers.length === 0) continue;

    const seeded = assignSeeds(catPlayers);
    const groupCount = calculateGroupsForCount(catPlayers.length);
    const { assignments, cbi } = snakeDistributeWithCBI(seeded, groupCount);

    results.set(cat, {
      category: cat,
      assignments,
      cbi,
    });
  }

  return results;
}

export function getPlayersInGroup(
  assignments: GroupAssignment[],
  groupIndex: number
): GroupAssignment[] {
  return assignments.filter((a) => a.groupIndex === groupIndex);
}
