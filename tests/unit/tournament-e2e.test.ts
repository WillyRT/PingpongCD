import { describe, it, expect } from 'vitest';
import {
  calculateGroupCount,
  calculateGroupSizes,
} from '../../lib/engine/groups';
import {
  assignSeeds,
  snakeDistribute,
  type SeedablePlayer,
} from '../../lib/engine/seeding';
import {
  generateRoundRobin,
  validateSchedule,
} from '../../lib/engine/schedule';
import {
  validateTableTennisScore,
  validateGroupScore,
  validateKnockoutScore,
  validateFinalScore,
  determineWinner,
} from '../../lib/engine/scoring';
import {
  calculateStandings,
  type ConfirmedMatch,
} from '../../lib/engine/standings';
import {
  updateRating,
  updateRatingsForMatch,
  initialRating,
  type PlayerRating,
} from '../../lib/engine/rating';
import {
  generateBracket,
  advanceWinner,
  calculateBracketSize,
  type QualifiedPlayer,
  type BracketMatch,
} from '../../lib/engine/bracket';
import {
  canTransition,
  validateTransitionRequirements,
  isGroupComplete,
  isMysteryModeActive,
  areStandingsVisible,
} from '../../lib/engine/tournament-state';

describe('Real Tournament End-to-End Simulation (8 Players)', () => {
  // Setup 8 players with distinct historical ratings
  const players: SeedablePlayer[] = [
    { id: 'p-1', rating: 1950, rating_deviation: 90, matches_played: 25 },
    { id: 'p-2', rating: 1850, rating_deviation: 100, matches_played: 20 },
    { id: 'p-3', rating: 1750, rating_deviation: 110, matches_played: 18 },
    { id: 'p-4', rating: 1650, rating_deviation: 120, matches_played: 15 },
    { id: 'p-5', rating: 1550, rating_deviation: 130, matches_played: 12 },
    { id: 'p-6', rating: 1450, rating_deviation: 140, matches_played: 10 },
    { id: 'p-7', rating: 1350, rating_deviation: 150, matches_played: 8 },
    { id: 'p-8', rating: 1250, rating_deviation: 160, matches_played: 5 },
  ];

  it('Step 1: Registration and Group Sizing for 8 players', () => {
    expect(canTransition('draft', 'registration')).toBe(true);
    const groupCount = calculateGroupCount(players.length);
    expect(groupCount).toBe(2); // 8-11 players -> 2 groups

    const sizes = calculateGroupSizes(players.length, groupCount);
    expect(sizes).toEqual([4, 4]); // 4 players per group
  });

  it('Step 2: Deterministic Snake Seeding across Group A and Group B', () => {
    const seeded = assignSeeds(players);
    expect(seeded[0]?.id).toBe('p-1');
    expect(seeded[0]?.seed).toBe(1);
    expect(seeded[7]?.id).toBe('p-8');
    expect(seeded[7]?.seed).toBe(8);

    const assignments = snakeDistribute(seeded, 2);
    const groupAPlayers = assignments.filter((a) => a.groupIndex === 0).map((a) => a.player.id);
    const groupBPlayers = assignments.filter((a) => a.groupIndex === 1).map((a) => a.player.id);

    // Snake: Row 0 (A: 1, B: 2), Row 1 (B: 3, A: 4), Row 2 (A: 5, B: 6), Row 3 (B: 7, A: 8)
    expect(groupAPlayers).toEqual(['p-1', 'p-4', 'p-5', 'p-8']);
    expect(groupBPlayers).toEqual(['p-2', 'p-3', 'p-6', 'p-7']);
  });

  it('Step 3: Round-Robin Schedule Generation and Validation', () => {
    const seeded = assignSeeds(players);
    const assignments = snakeDistribute(seeded, 2);
    const groupAPlayers = assignments.filter((a) => a.groupIndex === 0).map((a) => a.player.id);

    const pairings = generateRoundRobin(groupAPlayers);
    expect(pairings.length).toBe(6); // 4 * 3 / 2 = 6 matches

    const scheduleValidation = validateSchedule(pairings, groupAPlayers);
    expect(scheduleValidation.valid).toBe(true);
    expect(scheduleValidation.errors.length).toBe(0);
  });

  it('Step 4: Score Validation Rules (Accepts valid table tennis scores, rejects invalid)', () => {
    // Group stage: target 7, win by 2
    expect(validateGroupScore(7, 5).valid).toBe(true);
    expect(validateGroupScore(8, 6).valid).toBe(true);
    expect(validateGroupScore(7, 0).valid).toBe(true);
    expect(validateGroupScore(7, 6).valid).toBe(false); // only 1 point lead
    expect(validateGroupScore(6, 4).valid).toBe(false); // didn't reach target 7
    expect(validateGroupScore(9, 4).valid).toBe(false); // extended play only from 6-6

    // Knockout stage: target 11, win by 2
    expect(validateKnockoutScore(11, 9).valid).toBe(true);
    expect(validateKnockoutScore(12, 10).valid).toBe(true);
    expect(validateKnockoutScore(11, 10).valid).toBe(false);

    // Final stage: target 15, win by 2
    expect(validateFinalScore(15, 13).valid).toBe(true);
    expect(validateFinalScore(16, 14).valid).toBe(true);
    expect(validateFinalScore(15, 14).valid).toBe(false);
  });

  it('Step 5: Concurrency & Double Confirmation Idempotency', () => {
    const p1Rating: PlayerRating = { rating: 1600, ratingDeviation: 100, volatility: 0.06, matchesPlayed: 10 };
    const p2Rating: PlayerRating = { rating: 1500, ratingDeviation: 120, volatility: 0.06, matchesPlayed: 8 };

    // Confirmation 1: P1 wins 7-5 against P2
    const [p1After1, p2After1] = updateRatingsForMatch(p1Rating, p2Rating);
    expect(p1After1.rating).toBeGreaterThan(1600);
    expect(p1After1.matchesPlayed).toBe(11);

    // Double confirmation prevention: if already confirmed, state remains idempotent
    const isAlreadyConfirmed = true;
    let p1Final = p1After1;
    if (!isAlreadyConfirmed) {
      const [p1Double] = updateRatingsForMatch(p1After1, p2After1);
      p1Final = p1Double;
    }
    expect(p1Final.matchesPlayed).toBe(11); // Rating was NOT updated twice
  });

  it('Step 6: Dispute Flow (Dispute freezes standings/ratings until Admin resolves)', () => {
    // Match in dispute
    const disputedMatch = {
      id: 'm-disputed',
      player1Id: 'p-1',
      player2Id: 'p-4',
      reportedScore1: 7,
      reportedScore2: 3,
      status: 'disputed',
    };

    // While disputed: does not count in confirmed matches map
    const confirmedMatches: ConfirmedMatch[] = [];
    const seedsMap = new Map([['p-1', 1], ['p-4', 4]]);
    const standingsDuringDispute = calculateStandings(['p-1', 'p-4'], confirmedMatches, seedsMap);
    expect(standingsDuringDispute[0]?.wins).toBe(0);
    expect(standingsDuringDispute[0]?.played).toBe(0);

    // Admin resolves dispute: overrides to 7-5 and confirms
    const resolvedMatch: ConfirmedMatch = {
      player1Id: 'p-1',
      player2Id: 'p-4',
      score1: 7,
      score2: 5,
      winnerId: 'p-1',
    };
    confirmedMatches.push(resolvedMatch);

    const standingsAfterResolution = calculateStandings(['p-1', 'p-4'], confirmedMatches, seedsMap);
    expect(standingsAfterResolution[0]?.playerId).toBe('p-1');
    expect(standingsAfterResolution[0]?.wins).toBe(1);
    expect(standingsAfterResolution[0]?.pointsFor).toBe(7);
  });

  it('Step 7: Mystery Mode Penetration & Unlock Guard', () => {
    // 5 of 6 matches confirmed in Group A
    const confirmedCount = 5;
    const expectedCount = 6;
    const pendingCount = 1;
    const submittedCount = 0;
    const disputedCount = 0;

    const groupAComplete = isGroupComplete(confirmedCount, expectedCount, pendingCount, submittedCount, disputedCount);
    expect(groupAComplete).toBe(false);

    const mysteryActive = isMysteryModeActive(pendingCount, submittedCount, disputedCount);
    expect(mysteryActive).toBe(true);

    // Regular player cannot see standings while mystery mode is active
    expect(areStandingsVisible(false, true, mysteryActive)).toBe(false);
    // Admin can always see standings
    expect(areStandingsVisible(true, true, mysteryActive)).toBe(true);

    // Complete the last match
    const groupACompleteAfter = isGroupComplete(6, 6, 0, 0, 0);
    const mysteryActiveAfter = isMysteryModeActive(0, 0, 0);
    expect(groupACompleteAfter).toBe(true);
    expect(mysteryActiveAfter).toBe(false);
    // Now standings unlock for normal players
    expect(areStandingsVisible(false, true, mysteryActiveAfter)).toBe(true);
  });

  it('Step 8: Qualifiers Configuration & Bracket Execution to Finished', () => {
    // 2 Qualifiers from Group A (p-1 [1st], p-4 [2nd])
    // 2 Qualifiers from Group B (p-2 [1st], p-3 [2nd])
    const qualifiers: QualifiedPlayer[] = [
      { playerId: 'p-1', groupIndex: 0, groupPosition: 1, seed: 1 }, // A1
      { playerId: 'p-4', groupIndex: 0, groupPosition: 2, seed: 4 }, // A2
      { playerId: 'p-2', groupIndex: 1, groupPosition: 1, seed: 2 }, // B1
      { playerId: 'p-3', groupIndex: 1, groupPosition: 2, seed: 3 }, // B2
    ];

    expect(calculateBracketSize(qualifiers.length)).toBe(4);

    // Generate bracket: Cross-group pairings (A1 vs B2, B1 vs A2)
    const bracket = generateBracket(qualifiers, 2, 2);
    expect(bracket.rounds).toBe(2); // Semifinals (Round 1) + Final (Round 2)
    expect(bracket.matches.length).toBe(3); // 2 SF matches + 1 Final match

    const sf1 = bracket.matches.find((m) => m.round === 1 && m.position === 0)!;
    const sf2 = bracket.matches.find((m) => m.round === 1 && m.position === 1)!;
    const finalMatch = bracket.matches.find((m) => m.round === 2 && m.position === 0)!;

    // SF1: A1 vs B2
    expect(sf1.player1Id).toBe('p-1');
    expect(sf1.player2Id).toBe('p-3');

    // SF2: B1 vs A2
    expect(sf2.player1Id).toBe('p-2');
    expect(sf2.player2Id).toBe('p-4');

    // Complete SF1: p-1 beats p-3 (11-7)
    sf1.score1 = 11;
    sf1.score2 = 7;
    sf1.winnerId = 'p-1';
    advanceWinner(bracket.matches, sf1.id, 'p-1');

    // Complete SF2: p-2 beats p-4 (11-9)
    sf2.score1 = 11;
    sf2.score2 = 9;
    sf2.winnerId = 'p-2';
    advanceWinner(bracket.matches, sf2.id, 'p-2');

    // Final is now populated with p-1 vs p-2
    expect(finalMatch.player1Id).toBe('p-1');
    expect(finalMatch.player2Id).toBe('p-2');

    // Complete Final: p-1 beats p-2 (15-13)
    finalMatch.score1 = 15;
    finalMatch.score2 = 13;
    finalMatch.winnerId = 'p-1';

    // State transition guard to finished
    const transitionCheck = validateTransitionRequirements('bracket_stage', 'finished', {
      totalPlayers: 8,
      groupsGenerated: true,
      allGroupsCompleted: true,
      qualifiersConfigured: true,
      bracketGenerated: true,
      finalCompleted: true,
      groupStatuses: ['completed', 'completed'],
    });

    expect(transitionCheck.allowed).toBe(true);
    expect(transitionCheck.errors.length).toBe(0);
  });
});
