import { describe, it, expect } from 'vitest';
import {
  comparePlayers,
  assignSeeds,
  snakeDistribute,
  getPlayersInGroup,
  type SeedablePlayer,
} from '../../lib/engine/seeding';

function makePlayer(id: string, rating: number, rd = 350, mp = 0): SeedablePlayer {
  return { id, rating, rating_deviation: rd, matches_played: mp };
}

describe('Seeding Engine', () => {
  describe('comparePlayers', () => {
    it('should rank higher rating first', () => {
      const a = makePlayer('a', 1800);
      const b = makePlayer('b', 1600);
      expect(comparePlayers(a, b)).toBeLessThan(0); // a before b
    });

    it('should use rating_deviation as tiebreaker (lower = better)', () => {
      const a = makePlayer('a', 1500, 100);
      const b = makePlayer('b', 1500, 200);
      expect(comparePlayers(a, b)).toBeLessThan(0); // a has lower RD
    });

    it('should use matches_played as tiebreaker (more = better)', () => {
      const a = makePlayer('a', 1500, 350, 20);
      const b = makePlayer('b', 1500, 350, 10);
      expect(comparePlayers(a, b)).toBeLessThan(0);
    });

    it('should use UUID as last resort (deterministic)', () => {
      const a = makePlayer('aaa', 1500, 350, 0);
      const b = makePlayer('bbb', 1500, 350, 0);
      expect(comparePlayers(a, b)).toBeLessThan(0);
    });

    it('should never use randomness', () => {
      const a = makePlayer('x', 1500);
      const b = makePlayer('y', 1500);
      const results = new Set<number>();
      for (let i = 0; i < 100; i++) {
        results.add(Math.sign(comparePlayers(a, b)));
      }
      expect(results.size).toBe(1); // Always same result
    });
  });

  describe('assignSeeds', () => {
    it('should assign seed 1 to highest rated', () => {
      const players = [
        makePlayer('c', 1400),
        makePlayer('a', 1800),
        makePlayer('b', 1600),
      ];
      const seeded = assignSeeds(players);
      expect(seeded[0]?.id).toBe('a');
      expect(seeded[0]?.seed).toBe(1);
      expect(seeded[1]?.id).toBe('b');
      expect(seeded[1]?.seed).toBe(2);
      expect(seeded[2]?.id).toBe('c');
      expect(seeded[2]?.seed).toBe(3);
    });
  });

  describe('snakeDistribute', () => {
    it('should distribute 8 players across 4 groups correctly', () => {
      const players = Array.from({ length: 8 }, (_, i) =>
        ({ ...makePlayer(`p${i + 1}`, 2000 - i * 50), seed: i + 1 })
      );
      const assignments = snakeDistribute(players, 4);

      // Row 1: A(1) B(2) C(3) D(4)
      // Row 2: D(5) C(6) B(7) A(8)
      const groupA = assignments.filter(a => a.groupIndex === 0).map(a => a.seed);
      const groupB = assignments.filter(a => a.groupIndex === 1).map(a => a.seed);
      const groupC = assignments.filter(a => a.groupIndex === 2).map(a => a.seed);
      const groupD = assignments.filter(a => a.groupIndex === 3).map(a => a.seed);

      expect(groupA).toEqual([1, 8]);
      expect(groupB).toEqual([2, 7]);
      expect(groupC).toEqual([3, 6]);
      expect(groupD).toEqual([4, 5]);
    });

    it('should distribute 24 players across 4 groups (snake)', () => {
      const players = Array.from({ length: 24 }, (_, i) =>
        ({ ...makePlayer(`p${i + 1}`, 2400 - i * 50), seed: i + 1 })
      );
      const assignments = snakeDistribute(players, 4);

      const groupA = assignments.filter(a => a.groupIndex === 0).map(a => a.seed);
      const groupB = assignments.filter(a => a.groupIndex === 1).map(a => a.seed);
      const groupC = assignments.filter(a => a.groupIndex === 2).map(a => a.seed);
      const groupD = assignments.filter(a => a.groupIndex === 3).map(a => a.seed);

      expect(groupA).toEqual([1, 8, 9, 16, 17, 24]);
      expect(groupB).toEqual([2, 7, 10, 15, 18, 23]);
      expect(groupC).toEqual([3, 6, 11, 14, 19, 22]);
      expect(groupD).toEqual([4, 5, 12, 13, 20, 21]);
    });

    it('should handle single group', () => {
      const players = Array.from({ length: 5 }, (_, i) =>
        ({ ...makePlayer(`p${i + 1}`, 1500), seed: i + 1 })
      );
      const assignments = snakeDistribute(players, 1);
      expect(assignments.every(a => a.groupIndex === 0)).toBe(true);
      expect(assignments.length).toBe(5);
    });
  });
});
