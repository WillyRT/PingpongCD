import { describe, it, expect } from 'vitest';
import {
  calculateStandings,
  getHeadToHead,
  type ConfirmedMatch,
} from '../../lib/engine/standings';

describe('Standings Engine', () => {
  const seeds = new Map<string, number>([
    ['p1', 1],
    ['p2', 2],
    ['p3', 3],
    ['p4', 4],
  ]);

  it('should rank by wins primary criterion', () => {
    const playerIds = ['p1', 'p2', 'p3', 'p4'];
    const matches: ConfirmedMatch[] = [
      { player1Id: 'p1', player2Id: 'p2', score1: 7, score2: 2, winnerId: 'p1' },
      { player1Id: 'p1', player2Id: 'p3', score1: 7, score2: 1, winnerId: 'p1' },
      { player1Id: 'p1', player2Id: 'p4', score1: 7, score2: 3, winnerId: 'p1' },
      { player1Id: 'p2', player2Id: 'p3', score1: 7, score2: 4, winnerId: 'p2' },
      { player1Id: 'p2', player2Id: 'p4', score1: 7, score2: 5, winnerId: 'p2' },
      { player1Id: 'p3', player2Id: 'p4', score1: 7, score2: 6, winnerId: 'p3' },
    ];

    const standings = calculateStandings(playerIds, matches, seeds);

    expect(standings.map(s => s.playerId)).toEqual(['p1', 'p2', 'p3', 'p4']);
    expect(standings[0]?.wins).toBe(3);
    expect(standings[1]?.wins).toBe(2);
    expect(standings[2]?.wins).toBe(1);
    expect(standings[3]?.wins).toBe(0);
  });

  describe('2-way tiebreaker: Head-to-Head', () => {
    it('should resolve a 2-way tie using head-to-head winner', () => {
      const playerIds = ['p1', 'p2', 'p3', 'p4'];
      // p1 beats p2 in their direct match, but both finish with 2 wins
      const matches: ConfirmedMatch[] = [
        { player1Id: 'p1', player2Id: 'p2', score1: 7, score2: 5, winnerId: 'p1' },
        { player1Id: 'p1', player2Id: 'p3', score1: 7, score2: 3, winnerId: 'p1' },
        { player1Id: 'p1', player2Id: 'p4', score1: 5, score2: 7, winnerId: 'p4' },
        { player1Id: 'p2', player2Id: 'p3', score1: 7, score2: 4, winnerId: 'p2' },
        { player1Id: 'p2', player2Id: 'p4', score1: 7, score2: 2, winnerId: 'p2' },
        { player1Id: 'p3', player2Id: 'p4', score1: 7, score2: 5, winnerId: 'p3' },
      ];
      // p1: 2 wins (beat p2, p3; lost to p4)
      // p2: 2 wins (beat p3, p4; lost to p1)
      // H2H: p1 beat p2 -> p1 should be ranked above p2
      const standings = calculateStandings(playerIds, matches, seeds);

      const p1Standing = standings.find(s => s.playerId === 'p1')!;
      const p2Standing = standings.find(s => s.playerId === 'p2')!;

      expect(p1Standing.wins).toBe(2);
      expect(p2Standing.wins).toBe(2);
      expect(p1Standing.position).toBeLessThan(p2Standing.position);
    });
  });

  describe('3-way tiebreaker: Mini-League', () => {
    it('should resolve 3-way circular tie using point difference within mini-league', () => {
      const playerIds = ['p1', 'p2', 'p3', 'p4'];
      // Circular: p1 beats p2, p2 beats p3, p3 beats p1 (all beat p4)
      // Scores between tied:
      // p1 vs p2: 7-1 (+6 for p1, -6 for p2)
      // p2 vs p3: 7-0 (+7 for p2, -7 for p3)
      // p3 vs p1: 7-5 (+2 for p3, -2 for p1)
      // Mini-league diffs:
      // p1: +6 - 2 = +4
      // p2: -6 + 7 = +1
      // p3: -7 + 2 = -5
      // Expected order: p1, p2, p3
      const matches: ConfirmedMatch[] = [
        { player1Id: 'p1', player2Id: 'p2', score1: 7, score2: 1, winnerId: 'p1' },
        { player1Id: 'p2', player2Id: 'p3', score1: 7, score2: 0, winnerId: 'p2' },
        { player1Id: 'p3', player2Id: 'p1', score1: 7, score2: 5, winnerId: 'p3' },
        // All beat p4
        { player1Id: 'p1', player2Id: 'p4', score1: 7, score2: 3, winnerId: 'p1' },
        { player1Id: 'p2', player2Id: 'p4', score1: 7, score2: 4, winnerId: 'p2' },
        { player1Id: 'p3', player2Id: 'p4', score1: 7, score2: 2, winnerId: 'p3' },
      ];

      const standings = calculateStandings(playerIds, matches, seeds);

      expect(standings[0]?.playerId).toBe('p1');
      expect(standings[1]?.playerId).toBe('p2');
      expect(standings[2]?.playerId).toBe('p3');
      expect(standings[3]?.playerId).toBe('p4');
    });
  });

  describe('Deterministic seed fallback', () => {
    it('should fall back to seed when all criteria are identical', () => {
      const playerIds = ['p1', 'p2'];
      // No matches played yet
      const standings = calculateStandings(playerIds, [], seeds);

      expect(standings[0]?.playerId).toBe('p1'); // Seed 1
      expect(standings[1]?.playerId).toBe('p2'); // Seed 2
    });
  });

  describe('getHeadToHead', () => {
    it('should find match regardless of player order', () => {
      const match: ConfirmedMatch = { player1Id: 'a', player2Id: 'b', score1: 7, score2: 4, winnerId: 'a' };
      expect(getHeadToHead('a', 'b', [match])).toBeDefined();
      expect(getHeadToHead('b', 'a', [match])).toBeDefined();
      expect(getHeadToHead('a', 'c', [match])).toBeUndefined();
    });
  });
});
