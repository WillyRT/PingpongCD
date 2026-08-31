import { MAX_GROUPS, MIN_PLAYERS, GROUP_THRESHOLDS } from './constants';
import { isSeniorEligible } from './categories';
import type { AgeCategory } from '../types/domain';

/**
 * Calculate the number of groups based on total players.
 * Rules per spec §7:
 *   4-7  → 1 group
 *   8-11 → 2 groups  
 *   12-15 → 3 groups
 *   16+ → 4 groups
 * Maximum: 4 groups
 * Minimum: 4 players
 */
export function calculateGroupCount(totalPlayers: number): number {
  if (totalPlayers < MIN_PLAYERS) {
    throw new Error(`Need at least ${MIN_PLAYERS} players to form groups. Got ${totalPlayers}.`);
  }

  for (const threshold of GROUP_THRESHOLDS) {
    if (totalPlayers >= threshold.min && totalPlayers <= threshold.max) {
      return threshold.groups;
    }
  }

  return MAX_GROUPS;
}

/**
 * Calculate balanced group sizes.
 * The difference between any two groups is at most 1 player.
 * 
 * @param totalPlayers Total number of participants
 * @param groupCount Number of groups
 * @returns Array of group sizes, e.g. [6, 6, 6, 5] for 23 players in 4 groups
 */
export function calculateGroupSizes(totalPlayers: number, groupCount: number): number[] {
  if (groupCount < 1 || groupCount > MAX_GROUPS) {
    throw new Error(`Group count must be between 1 and ${MAX_GROUPS}. Got ${groupCount}.`);
  }
  if (totalPlayers < groupCount) {
    throw new Error(`Cannot have more groups (${groupCount}) than players (${totalPlayers}).`);
  }

  const baseSize = Math.floor(totalPlayers / groupCount);
  const remainder = totalPlayers % groupCount;

  const sizes: number[] = [];
  for (let i = 0; i < groupCount; i++) {
    sizes.push(i < remainder ? baseSize + 1 : baseSize);
  }

  return sizes;
}

/**
 * Validate that a group distribution is balanced.
 * Max difference between any two groups must be <= 1.
 */
export function validateGroupDistribution(sizes: number[]): boolean {
  if (sizes.length === 0) return false;
  const max = Math.max(...sizes);
  const min = Math.min(...sizes);
  return max - min <= 1;
}

/** Get group label from index (0 = 'A', 1 = 'B', etc.) */
export function getGroupLabel(index: number): string {
  return String.fromCharCode(65 + index); // A, B, C, D
}

/** Filter players eligible for senior groups GA-GD */
export function filterSeniorGroupPlayers<T extends { category?: AgeCategory | string | null }>(players: T[]): T[] {
  return players.filter((p) => isSeniorEligible(p.category));
}

/**
 * Assigns players to senior groups GA-GD based on isSeniorEligible.
 */
export function assignSeniorGroups<T extends { id: string; category?: AgeCategory | string | null }>(
  players: T[],
  groupCount: number = 4
): Map<string, T[]> {
  const eligible = filterSeniorGroupPlayers(players);
  const groups = new Map<string, T[]>();
  for (let i = 0; i < groupCount; i++) {
    groups.set(getGroupLabel(i), []);
  }
  eligible.forEach((player, idx) => {
    const code = getGroupLabel(idx % groupCount);
    groups.get(code)?.push(player);
  });
  return groups;
}
