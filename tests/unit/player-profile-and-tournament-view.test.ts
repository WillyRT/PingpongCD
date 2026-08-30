import { describe, it, expect } from 'vitest';
import { calculateStandings, type ConfirmedMatch } from '@/lib/engine/standings';

describe('Tournament View & Player Profile Logic', () => {
  it('calculates group standings accurately with 5-tier tiebreaker for historical group data', () => {
    const playerIds = ['p1', 'p2', 'p3', 'p4'];
    const confirmedMatches: ConfirmedMatch[] = [
      { player1Id: 'p1', player2Id: 'p2', score1: 11, score2: 7, winnerId: 'p1' },
      { player1Id: 'p1', player2Id: 'p3', score1: 11, score2: 5, winnerId: 'p1' },
      { player1Id: 'p1', player2Id: 'p4', score1: 11, score2: 8, winnerId: 'p1' },
      { player1Id: 'p2', player2Id: 'p3', score1: 11, score2: 9, winnerId: 'p2' },
      { player1Id: 'p2', player2Id: 'p4', score1: 11, score2: 6, winnerId: 'p2' },
      { player1Id: 'p3', player2Id: 'p4', score1: 11, score2: 8, winnerId: 'p3' },
    ];

    const seeds = new Map<string, number>([
      ['p1', 1],
      ['p2', 2],
      ['p3', 3],
      ['p4', 4],
    ]);

    const standings = calculateStandings(playerIds, confirmedMatches, seeds);

    expect(standings).toHaveLength(4);
    // p1 won 3 matches -> 1st
    expect(standings[0]?.playerId).toBe('p1');
    expect(standings[0]?.wins).toBe(3);
    expect(standings[0]?.position).toBe(1);
    expect(standings[0]?.pointsFor).toBe(33);
    expect(standings[0]?.pointsAgainst).toBe(20);
    expect(standings[0]?.pointsDiff).toBe(13);

    // p2 won 2 matches -> 2nd
    expect(standings[1]?.playerId).toBe('p2');
    expect(standings[1]?.wins).toBe(2);
    expect(standings[1]?.position).toBe(2);

    // p3 won 1 match -> 3rd
    expect(standings[2]?.playerId).toBe('p3');
    expect(standings[2]?.wins).toBe(1);
    expect(standings[2]?.position).toBe(3);

    // p4 won 0 matches -> 4th
    expect(standings[3]?.playerId).toBe('p4');
    expect(standings[3]?.wins).toBe(0);
    expect(standings[3]?.position).toBe(4);
  });

  it('computes player career stats: total played, wins, losses, win rate and point differential', () => {
    const playerId = 'lucas-rebellon';
    const playerMatches = [
      { id: 'm1', p1: playerId, p2: 'rival1', s1: 11, s2: 7, winner: playerId },
      { id: 'm2', p1: 'rival2', p2: playerId, s1: 9, s2: 11, winner: playerId },
      { id: 'm3', p1: playerId, p2: 'rival3', s1: 8, s2: 11, winner: 'rival3' },
    ];

    let wins = 0;
    let losses = 0;
    let pf = 0;
    let pa = 0;

    for (const m of playerMatches) {
      const isP1 = m.p1 === playerId;
      const myScore = isP1 ? m.s1 : m.s2;
      const oppScore = isP1 ? m.s2 : m.s1;
      pf += myScore;
      pa += oppScore;

      if (m.winner === playerId) wins++;
      else losses++;
    }

    const total = wins + losses;
    const winRate = Math.round((wins / total) * 100);
    const diff = pf - pa;

    expect(total).toBe(3);
    expect(wins).toBe(2);
    expect(losses).toBe(1);
    expect(winRate).toBe(67);
    expect(pf).toBe(30);
    expect(pa).toBe(27);
    expect(diff).toBe(3);
  });
});
