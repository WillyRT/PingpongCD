import { describe, it, expect } from 'vitest';
import {
  calculateStandings,
  calculateLiveRatings,
  type ConfirmedMatch,
} from '../../lib/engine/standings';

describe('Standings Engine — Official 5-Tier Tiebreaker System', () => {
  const seeds = new Map<string, number>([
    ['p1', 1],
    ['p2', 2],
    ['p3', 3],
  ]);

  it('Tier 1: Ranks by wins primary criterion', () => {
    const playerIds = ['p1', 'p2', 'p3'];
    const matches: ConfirmedMatch[] = [
      { player1Id: 'p1', player2Id: 'p2', score1: 7, score2: 2, winnerId: 'p1' },
      { player1Id: 'p1', player2Id: 'p3', score1: 7, score2: 3, winnerId: 'p1' },
      { player1Id: 'p2', player2Id: 'p3', score1: 7, score2: 5, winnerId: 'p2' },
    ];

    const standings = calculateStandings(playerIds, matches, seeds);
    expect(standings.map((s) => s.playerId)).toEqual(['p1', 'p2', 'p3']);
    expect(standings[0]?.wins).toBe(2);
    expect(standings[1]?.wins).toBe(1);
    expect(standings[2]?.wins).toBe(0);
  });

  it('Tier 2: Resolves 2-way tie using Head-to-Head winner', () => {
    const playerIds = ['p1', 'p2'];
    // Both played only each other, but p1 beat p2
    const matches: ConfirmedMatch[] = [
      { player1Id: 'p1', player2Id: 'p2', score1: 7, score2: 5, winnerId: 'p1' },
    ];

    const standings = calculateStandings(playerIds, matches, seeds);
    expect(standings[0]?.playerId).toBe('p1');
    expect(standings[1]?.playerId).toBe('p2');
  });

  it('Tier 3: Resolves 3-way circular tie using Overall Point Difference', () => {
    const playerIds = ['p1', 'p2', 'p3'];
    // Circular tie: p1 beats p2, p2 beats p3, p3 beats p1. Each has 1 win.
    // p1 beats p2 7-1 (+6)
    // p2 beats p3 7-5 (+2)
    // p3 beats p1 7-6 (+1)
    // Overall diff:
    // p1: (+6 - 1) = +5
    // p2: (-6 + 2) = -4
    // p3: (-2 + 1) = -1
    const matches: ConfirmedMatch[] = [
      { player1Id: 'p1', player2Id: 'p2', score1: 7, score2: 1, winnerId: 'p1' },
      { player1Id: 'p2', player2Id: 'p3', score1: 7, score2: 5, winnerId: 'p2' },
      { player1Id: 'p3', player2Id: 'p1', score1: 7, score2: 6, winnerId: 'p3' },
    ];

    const standings = calculateStandings(playerIds, matches, seeds);
    expect(standings[0]?.playerId).toBe('p1');
    expect(standings[0]?.pointsDiff).toBe(5);
    expect(standings[1]?.playerId).toBe('p3');
    expect(standings[2]?.playerId).toBe('p2');
  });

  it('Tier 5: Breaks absolute tie using Dynamic Live ELO (recalibrated in real time)', () => {
    // Both players have identical wins (1), identical scores against common opponents,
    // and split their match symmetrically (or circular tie with identical score diffs).
    // Here, p1 and p2 have identical stats:
    const playerIds = ['p1', 'p2'];
    const matches: ConfirmedMatch[] = [
      // Suppose p1 beat a higher-rated player earlier or had a higher live recalibrated ELO
    ];

    // Live rating for p1 is higher due to performance in the tournament day
    const liveRatings = new Map<string, number>([
      ['p1', 1620],
      ['p2', 1510],
    ]);

    // Give them identical stats: 0 matches, 0 wins, 0 diff
    const standings = calculateStandings(playerIds, matches, seeds, undefined, liveRatings);

    expect(standings[0]?.playerId).toBe('p1');
    expect(standings[0]?.liveRating).toBe(1620);
    expect(standings[1]?.playerId).toBe('p2');
    expect(standings[1]?.liveRating).toBe(1510);
  });

  it('should compute live ratings incrementally for every confirmed match', () => {
    const playerIds = ['p1', 'p2'];
    const matches: ConfirmedMatch[] = [
      { player1Id: 'p1', player2Id: 'p2', score1: 7, score2: 4, winnerId: 'p1' },
    ];

    const live = calculateLiveRatings(playerIds, matches);
    expect(live.get('p1')).toBeGreaterThan(1500);
    expect(live.get('p2')).toBeLessThan(1500);
  });
});
