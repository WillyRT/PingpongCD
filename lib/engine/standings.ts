/**
 * Standings calculation with official 5-tier tiebreaker system:
 * 1. Wins / Losses (V/D): Highest match win count.
 * 2. Head-to-Head:
 *    - 2 tied: Winner of the direct head-to-head match.
 *    - 3+ tied: Most wins in the mini-league between tied players.
 * 3. Overall Point Difference: (Points For - Points Against in all group matches).
 * 4. Point Difference between Tied Players: (Points For - Points Against in direct matches between tied players).
 * 5. Live Recalibrated Dynamic ELO Rating: Highest live dynamic rating after matches played so far.
 * (Deterministic fallback: initial tournament seed / ID).
 */

export interface Standing {
  playerId: string;
  position: number;
  played: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  pointsDiff: number;
  seed: number;
  liveRating?: number;
}

export interface ConfirmedMatch {
  player1Id: string;
  player2Id: string;
  score1: number;
  score2: number;
  winnerId: string;
}

/**
 * Calculate dynamic live Elo ratings after all confirmed matches played so far.
 * Starts from base rating (initialRatings or 1500) and applies incremental updates (K=32).
 */
export function calculateLiveRatings(
  playerIds: string[],
  confirmedMatches: ConfirmedMatch[],
  initialRatings?: Map<string, number>
): Map<string, number> {
  const currentRatings = new Map<string, number>();
  for (const pid of playerIds) {
    currentRatings.set(pid, initialRatings?.get(pid) ?? 1500);
  }

  const K = 32;
  for (const match of confirmedMatches) {
    const r1 = currentRatings.get(match.player1Id) ?? 1500;
    const r2 = currentRatings.get(match.player2Id) ?? 1500;

    const expected1 = 1 / (1 + Math.pow(10, (r2 - r1) / 400));
    const actual1 = match.winnerId === match.player1Id ? 1 : 0;
    const actual2 = match.winnerId === match.player2Id ? 1 : 0;

    const newR1 = Math.round((r1 + K * (actual1 - expected1)) * 10) / 10;
    const newR2 = Math.round((r2 + K * (actual2 - (1 - expected1))) * 10) / 10;

    currentRatings.set(match.player1Id, newR1);
    currentRatings.set(match.player2Id, newR2);
  }

  return currentRatings;
}

/**
 * Calculate standings from confirmed matches using the strict 5-tier tiebreaker hierarchy.
 */
export function calculateStandings(
  playerIds: string[],
  confirmedMatches: ConfirmedMatch[],
  seeds: Map<string, number>,
  initialRatings?: Map<string, number>,
  providedLiveRatings?: Map<string, number>
): Standing[] {
  const liveRatings = providedLiveRatings ?? calculateLiveRatings(playerIds, confirmedMatches, initialRatings);

  // 1. Build raw stats
  const statsMap = new Map<string, Omit<Standing, 'position'>>();

  for (const playerId of playerIds) {
    statsMap.set(playerId, {
      playerId,
      played: 0,
      wins: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      pointsDiff: 0,
      seed: seeds.get(playerId) ?? Infinity,
      liveRating: liveRatings.get(playerId) ?? 1500,
    });
  }

  for (const match of confirmedMatches) {
    const p1Stats = statsMap.get(match.player1Id);
    const p2Stats = statsMap.get(match.player2Id);
    if (!p1Stats || !p2Stats) continue;

    p1Stats.played++;
    p2Stats.played++;
    p1Stats.pointsFor += match.score1;
    p1Stats.pointsAgainst += match.score2;
    p2Stats.pointsFor += match.score2;
    p2Stats.pointsAgainst += match.score1;

    if (match.winnerId === match.player1Id) {
      p1Stats.wins++;
      p2Stats.losses++;
    } else {
      p2Stats.wins++;
      p1Stats.losses++;
    }
  }

  for (const stats of statsMap.values()) {
    stats.pointsDiff = stats.pointsFor - stats.pointsAgainst;
  }

  // 2. Sort using the 5-tier hierarchy
  const entries = Array.from(statsMap.values());
  const sorted = sortWithTiebreakers(entries, confirmedMatches, seeds, liveRatings);

  // 3. Assign positions
  return sorted.map((entry, index) => ({
    ...entry,
    position: index + 1,
  }));
}

function sortWithTiebreakers(
  entries: Omit<Standing, 'position'>[],
  matches: ConfirmedMatch[],
  seeds: Map<string, number>,
  liveRatings: Map<string, number>
): Omit<Standing, 'position'>[] {
  // 1. Group by wins DESC
  const sorted = [...entries].sort((a, b) => b.wins - a.wins);

  const result: Omit<Standing, 'position'>[] = [];
  let i = 0;

  while (i < sorted.length) {
    let j = i;
    const currentEntry = sorted[i];
    if (!currentEntry) { i++; continue; }
    while (j < sorted.length && sorted[j]?.wins === currentEntry.wins) {
      j++;
    }

    const tiedGroup = sorted.slice(i, j);

    if (tiedGroup.length === 1) {
      result.push(tiedGroup[0]!);
    } else if (tiedGroup.length === 2) {
      // 2-way tie: evaluate Head-to-Head, then global diff, then tied diff, then Live ELO
      const resolved = resolveTwoWayTie(
        tiedGroup as [Omit<Standing, 'position'>, Omit<Standing, 'position'>],
        matches,
        seeds,
        liveRatings
      );
      result.push(...resolved);
    } else {
      // 3+ way tie: mini-league
      const resolved = resolveMiniLeague(tiedGroup, matches, seeds, liveRatings);
      result.push(...resolved);
    }

    i = j;
  }

  return result;
}

/**
 * Resolve 2-way tie:
 * 1. Head-to-head match winner
 * 2. Overall point difference (PF - PC)
 * 3. Point difference in H2H (tied diff)
 * 4. Dynamic Live ELO
 * 5. Seed
 */
function resolveTwoWayTie(
  players: [Omit<Standing, 'position'>, Omit<Standing, 'position'>],
  matches: ConfirmedMatch[],
  seeds: Map<string, number>,
  liveRatings: Map<string, number>
): Omit<Standing, 'position'>[] {
  const [a, b] = players;
  const h2h = getHeadToHead(a.playerId, b.playerId, matches);

  if (h2h) {
    if (h2h.winnerId === a.playerId) return [a, b];
    if (h2h.winnerId === b.playerId) return [b, a];
  }

  // 3. Global point diff
  if (a.pointsDiff !== b.pointsDiff) {
    return a.pointsDiff > b.pointsDiff ? [a, b] : [b, a];
  }

  // 4. Point difference between involved
  if (h2h) {
    const diffA = h2h.player1Id === a.playerId ? h2h.score1 - h2h.score2 : h2h.score2 - h2h.score1;
    const diffB = -diffA;
    if (diffA !== diffB) {
      return diffA > diffB ? [a, b] : [b, a];
    }
  }

  // 5. Dynamic Live ELO
  const eloA = liveRatings.get(a.playerId) ?? a.liveRating ?? 1500;
  const eloB = liveRatings.get(b.playerId) ?? b.liveRating ?? 1500;
  if (eloA !== eloB) {
    return eloA > eloB ? [a, b] : [b, a];
  }

  // Fallback: seed
  const seedA = seeds.get(a.playerId) ?? Infinity;
  const seedB = seeds.get(b.playerId) ?? Infinity;
  return seedA <= seedB ? [a, b] : [b, a];
}

/**
 * Resolve 3+ way tie:
 * 1. Wins in mini-league among tied players
 * 2. Overall point difference (Criterion 3)
 * 3. Point difference in mini-league between tied players (Criterion 4)
 * 4. Dynamic Live ELO (Criterion 5)
 * 5. Seed fallback
 */
function resolveMiniLeague(
  players: Omit<Standing, 'position'>[],
  matches: ConfirmedMatch[],
  seeds: Map<string, number>,
  liveRatings: Map<string, number>
): Omit<Standing, 'position'>[] {
  const tiedIds = new Set(players.map((p) => p.playerId));

  const miniMatches = matches.filter(
    (m) => tiedIds.has(m.player1Id) && tiedIds.has(m.player2Id)
  );

  const miniStats = new Map<string, { wins: number; pf: number; pa: number; diff: number }>();
  for (const p of players) {
    miniStats.set(p.playerId, { wins: 0, pf: 0, pa: 0, diff: 0 });
  }

  for (const m of miniMatches) {
    const s1 = miniStats.get(m.player1Id);
    const s2 = miniStats.get(m.player2Id);
    if (!s1 || !s2) continue;

    s1.pf += m.score1;
    s1.pa += m.score2;
    s2.pf += m.score2;
    s2.pa += m.score1;

    if (m.winnerId === m.player1Id) s1.wins++;
    else s2.wins++;
  }

  for (const stats of miniStats.values()) {
    stats.diff = stats.pf - stats.pa;
  }

  return [...players].sort((a, b) => {
    const aMini = miniStats.get(a.playerId);
    const bMini = miniStats.get(b.playerId);
    if (!aMini || !bMini) return 0;

    // 2. Mini-league wins among tied
    if (aMini.wins !== bMini.wins) return bMini.wins - aMini.wins;

    // 3. Overall point diff
    if (a.pointsDiff !== b.pointsDiff) return b.pointsDiff - a.pointsDiff;

    // 4. Point diff between tied players (mini-league diff)
    if (aMini.diff !== bMini.diff) return bMini.diff - aMini.diff;

    // Points for in mini-league
    if (aMini.pf !== bMini.pf) return bMini.pf - aMini.pf;

    // Overall points for
    if (a.pointsFor !== b.pointsFor) return b.pointsFor - a.pointsFor;

    // 5. Dynamic Live ELO
    const eloA = liveRatings.get(a.playerId) ?? a.liveRating ?? 1500;
    const eloB = liveRatings.get(b.playerId) ?? b.liveRating ?? 1500;
    if (eloA !== eloB) return eloB - eloA;

    // Seed fallback
    const seedA = seeds.get(a.playerId) ?? Infinity;
    const seedB = seeds.get(b.playerId) ?? Infinity;
    return seedA - seedB;
  });
}

export function getHeadToHead(
  player1Id: string,
  player2Id: string,
  matches: ConfirmedMatch[]
): ConfirmedMatch | undefined {
  return matches.find(
    (m) =>
      (m.player1Id === player1Id && m.player2Id === player2Id) ||
      (m.player1Id === player2Id && m.player2Id === player1Id)
  );
}

export { resolveMiniLeague as _resolveMiniLeagueForTesting };
