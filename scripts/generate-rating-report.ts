import {
  parseHistoricalRecords,
  replayHistoricalTournaments,
  type CanonicalPlayer,
  type PlayerAlias,
  type RawHistoricalMatchRecord,
  type HistoricalReplayResult,
} from '../lib/engine/historical';
import {
  HISTORICAL_2024_MATCHES,
  HISTORICAL_2025_MATCHES,
  HISTORICAL_2026_MATCHES,
} from '../lib/data';
import * as fs from 'fs';
import * as path from 'path';

function runReplay(): {
  result: HistoricalReplayResult;
  players: CanonicalPlayer[];
  aliases: PlayerAlias[];
  tourneyYearMap: Map<string, number>;
} {
  const allRecords: RawHistoricalMatchRecord[] = [
    ...HISTORICAL_2024_MATCHES,
    ...HISTORICAL_2025_MATCHES,
    ...HISTORICAL_2026_MATCHES,
  ].map((m) => ({
    tournamentName: m.tournamentName,
    year: m.season,
    tournamentDate: m.tournamentDate,
    stage: 'group',
    groupCode: m.groupCode,
    player1Name: m.player1Raw,
    player2Name: m.player2Raw,
    score1: m.score1,
    score2: m.score2,
    isMissing: m.isMissing,
  }));

  const playersMap = new Map<string, CanonicalPlayer>();
  const aliasesMap = new Map<string, PlayerAlias>();
  const parsedTournaments = parseHistoricalRecords(allRecords, playersMap, aliasesMap, () => `id-${Math.random().toString(36).slice(2, 8)}`);

  const replay = replayHistoricalTournaments(parsedTournaments);

  const tourneyYearMap = new Map<string, number>();
  for (const t of parsedTournaments) {
    tourneyYearMap.set(t.tournament.id, t.tournament.year);
  }

  return {
    result: replay,
    players: Array.from(playersMap.values()),
    aliases: Array.from(aliasesMap.values()),
    tourneyYearMap,
  };
}

const { result: replay, players, tourneyYearMap } = runReplay();

// Build structured report
const reportPlayers = players.map((p) => {
  const pSnaps = replay.snapshots.filter((s) => s.playerId === p.id);
  const snap2024 = pSnaps.find((s) => tourneyYearMap.get(s.ratingPeriodId) === 2024);
  const snap2025 = pSnaps.find((s) => tourneyYearMap.get(s.ratingPeriodId) === 2025);
  const snap2026 = pSnaps.find((s) => tourneyYearMap.get(s.ratingPeriodId) === 2026);

  const currentState = replay.ratingStates.get(p.id);

  return {
    id: p.id,
    canonicalName: p.canonicalName,
    currentRating: currentState?.rating ?? 1500,
    currentRD: currentState?.ratingDeviation ?? 350,
    currentVolatility: currentState?.volatility ?? 0.06,
    totalMatches: currentState?.matchesPlayed ?? 0,
    seasons: {
      "2024": snap2024 ? {
        rating: snap2024.ratingAfter,
        rd: snap2024.rdAfter,
        volatility: snap2024.volAfter,
        matches: snap2024.matchesInPeriod,
      } : null,
      "2025": snap2025 ? {
        rating: snap2025.ratingAfter,
        rd: snap2025.rdAfter,
        volatility: snap2025.volAfter,
        matches: snap2025.matchesInPeriod,
      } : null,
      "2026": snap2026 ? {
        rating: snap2026.ratingAfter,
        rd: snap2026.rdAfter,
        volatility: snap2026.volAfter,
        matches: snap2026.matchesInPeriod,
      } : null,
    }
  };
});

reportPlayers.sort((a, b) => b.currentRating - a.currentRating);

const output = {
  title: "TourneyMaster AI — Historical Rating Replay Report",
  generatedAt: new Date().toISOString(),
  periodModel: "Tournament-Based Periodic Updates (Glicko-2)",
  totalProcessedMatches: replay.processedMatchesCount,
  missingMatches: replay.missingMatchesCount,
  canonicalPlayersCount: players.length,
  players: reportPlayers,
};

fs.writeFileSync(
  path.join(process.cwd(), 'rating-replay-report.json'),
  JSON.stringify(output, null, 2),
  'utf-8'
);

console.log('Successfully generated rating-replay-report.json with', reportPlayers.length, 'players');
