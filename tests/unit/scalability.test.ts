import { describe, it, expect } from 'vitest';
import { calculateGroupCount, calculateGroupSizes, validateGroupDistribution } from '../../lib/engine/groups';
import { assignSeeds, snakeDistribute } from '../../lib/engine/seeding';
import { generateRoundRobin, calculateExpectedMatches, validateSchedule } from '../../lib/engine/schedule';
import type { SeedablePlayer } from '../../lib/engine/seeding';

function makePlayers(n: number): SeedablePlayer[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `player-${String(i + 1).padStart(3, '0')}`,
    rating: 1800 - i * 10,
    rating_deviation: 350,
    matches_played: 0,
  }));
}

describe('Scalability Tests', () => {
  const playerCounts = [4, 5, 7, 8, 10, 12, 15, 16, 17, 23, 24, 25, 30, 31, 40, 50, 100];

  it.each(playerCounts)('should handle %i players end-to-end', (n) => {
    // 1. Calculate groups
    const groupCount = calculateGroupCount(n);
    expect(groupCount).toBeGreaterThanOrEqual(1);
    expect(groupCount).toBeLessThanOrEqual(4);

    // 2. Calculate sizes
    const sizes = calculateGroupSizes(n, groupCount);
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(n);
    expect(validateGroupDistribution(sizes)).toBe(true);

    // 3. Seed players
    const players = makePlayers(n);
    const seeded = assignSeeds(players);
    expect(seeded.length).toBe(n);

    // 4. Snake distribute
    const assignments = snakeDistribute(seeded, groupCount);
    expect(assignments.length).toBe(n);

    // Check each group has expected size (multiset match and balanced distribution)
    const inGroupLengths = Array.from({ length: groupCount }, (_, g) => assignments.filter(a => a.groupIndex === g).length);
    expect([...inGroupLengths].sort()).toEqual([...sizes].sort());
    expect(validateGroupDistribution(inGroupLengths)).toBe(true);

    // 5. Generate schedule for each group
    for (let g = 0; g < groupCount; g++) {
      const groupPlayers = assignments
        .filter(a => a.groupIndex === g)
        .map(a => a.player.id);
      
      const groupSize = groupPlayers.length;
      const expectedMatches = calculateExpectedMatches(groupSize);
      const schedule = generateRoundRobin(groupPlayers);

      expect(schedule.length).toBe(expectedMatches);
      
      const validation = validateSchedule(schedule, groupPlayers);
      expect(validation.valid).toBe(true);
    }

    // 6. Verify no player appears in multiple groups
    const playerGroups = new Map<string, number>();
    for (const a of assignments) {
      const existing = playerGroups.get(a.player.id);
      if (existing !== undefined) {
        expect(existing).toBe(a.groupIndex); // Same group
      }
      playerGroups.set(a.player.id, a.groupIndex);
    }
  });
});
