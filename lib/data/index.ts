import { HISTORICAL_2024_MATCHES, HISTORICAL_2024_PLAYERS, type HistoricalRawMatch } from './historical-2024';
import { HISTORICAL_2025_MATCHES, HISTORICAL_2025_PLAYERS } from './historical-2025';
import { HISTORICAL_2026_MATCHES, HISTORICAL_2026_PLAYERS } from './historical-2026';

export * from './historical-2024';
export * from './historical-2025';
export * from './historical-2026';
export * from './master-history';

export interface HistoricalSeasonSummary {
  season: number;
  name: string;
  date: string;
  groupCount: number;
  totalPlayers: number;
  expectedMatches: number;
  suppliedMatches: number;
  missingMatches: number;
  isComplete: boolean;
}

export function getHistoricalSeasonSummaries(): HistoricalSeasonSummary[] {
  return [
    {
      season: 2024,
      name: 'Torneo 2024',
      date: '2024-06-15',
      groupCount: 3,
      totalPlayers: 21,
      expectedMatches: 63,
      suppliedMatches: HISTORICAL_2024_MATCHES.filter((m) => !m.isMissing).length,
      missingMatches: HISTORICAL_2024_MATCHES.filter((m) => m.isMissing).length,
      isComplete: true,
    },
    {
      season: 2025,
      name: 'Torneo 2025',
      date: '2025-06-14',
      groupCount: 4,
      totalPlayers: 29,
      expectedMatches: 91,
      suppliedMatches: HISTORICAL_2025_MATCHES.filter((m) => !m.isMissing).length,
      missingMatches: HISTORICAL_2025_MATCHES.filter((m) => m.isMissing).length,
      isComplete: true,
    },
    {
      season: 2026,
      name: 'Torneo 2026',
      date: '2026-02-20',
      groupCount: 4,
      totalPlayers: 24,
      expectedMatches: 60,
      suppliedMatches: HISTORICAL_2026_MATCHES.filter((m) => !m.isMissing).length, // 59
      missingMatches: HISTORICAL_2026_MATCHES.filter((m) => m.isMissing).length, // 1
      isComplete: false, // Group A is incomplete!
    },
  ];
}

export function getAllHistoricalRawMatches(): HistoricalRawMatch[] {
  return [
    ...HISTORICAL_2024_MATCHES,
    ...HISTORICAL_2025_MATCHES,
    ...HISTORICAL_2026_MATCHES,
  ];
}
