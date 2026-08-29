import { initialRating, updateRating, type PlayerRating, type RatingMatchResult } from './rating';
import { GLICKO2_SCALE, DEFAULT_RATING, DEFAULT_RATING_DEVIATION, DEFAULT_VOLATILITY } from './constants';

export type IdentityResolutionStatus = 'confirmed' | 'probable' | 'unresolved';

/** Canonical player representation in the historical archive */
export interface CanonicalPlayer {
  id: string;
  canonicalName: string;
  userId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Player alias mapping to a canonical player */
export interface PlayerAlias {
  id: string;
  playerId: string;
  alias: string;
  normalizedAlias: string;
  sourceSystem: string;
  sourceTournament?: string;
  sourceSeed?: number | null;
  sourceStatus?: string | null;
  confidence: number;
  resolutionStatus: IdentityResolutionStatus;
  createdAt: string;
}

/** Raw record from a historical source (CSV / JSON import) */
export interface RawHistoricalMatchRecord {
  tournamentName: string;
  year: number;
  tournamentDate: string;
  stage: 'group' | 'round_of_16' | 'quarterfinal' | 'semifinal' | 'final';
  groupCode?: string;
  player1Name: string;
  player2Name: string;
  score1: number;
  score2: number;
  winnerName?: string;
  isMissing?: boolean;
}

/** Historical Tournament */
export interface HistoricalTournament {
  id: string;
  importId: string | null;
  name: string;
  slug: string;
  year: number;
  tournamentDate: string;
  location: string | null;
  formatDetails?: Record<string, unknown>;
  createdAt: string;
}

/** Historical Group */
export interface HistoricalGroup {
  id: string;
  historicalTournamentId: string;
  groupCode: string;
  expectedMatches: number;
  createdAt: string;
}

export type HistoricalMatchStatus = 'complete' | 'missing' | 'unresolved' | 'invalid';

/** Historical Match */
export interface HistoricalMatch {
  id: string;
  historicalTournamentId: string;
  historicalGroupId: string | null;
  stage: string;
  player1Id: string;
  player2Id: string;
  player1SourceName: string;
  player2SourceName: string;
  scorePlayer1: number;
  scorePlayer2: number;
  winnerId: string | null;
  status: HistoricalMatchStatus;
  matchDate: string | null;
  sourceRecord?: Record<string, unknown>;
  createdAt: string;
}

/** Point-in-time rating snapshot after a tournament or period */
export interface RatingSnapshot {
  id: string;
  playerId: string;
  ratingPeriodId: string; // e.g. tournamentId or period string
  periodType: 'historical_tournament' | 'live_tournament' | 'manual_adjustment';
  ratingBefore: number;
  rdBefore: number;
  volBefore: number;
  ratingAfter: number;
  rdAfter: number;
  volAfter: number;
  matchesInPeriod: number;
  calculatedAt: string;
}

/** Current persisted rating state */
export interface RatingState {
  playerId: string;
  rating: number;
  ratingDeviation: number;
  volatility: number;
  matchesPlayed: number;
  lastCalculatedAt: string;
  updatedAt: string;
}

/** Historical Tournament with attached matches */
export interface HistoricalTournamentWithMatches {
  tournament: HistoricalTournament;
  groups: HistoricalGroup[];
  matches: HistoricalMatch[];
}

/** Replay execution result */
export interface HistoricalReplayResult {
  ratingStates: Map<string, RatingState>;
  snapshots: RatingSnapshot[];
  processedTournamentsCount: number;
  processedMatchesCount: number;
  missingMatchesCount: number;
}

/**
 * Extract clean name and source metadata from strings like:
 * "Pablo Gascon (10)" -> { cleanName: "Pablo Gascon", sourceSeed: 10, sourceStatus: null }
 * "Héctor Horcajada (8) (invitation pending)" -> { cleanName: "Héctor Horcajada", sourceSeed: 8, sourceStatus: "invitation_pending" }
 */
export function extractPlayerMetadata(rawName: string): {
  cleanName: string;
  sourceSeed: number | null;
  sourceStatus: string | null;
} {
  let clean = rawName.trim();
  let sourceSeed: number | null = null;
  let sourceStatus: string | null = null;

  // Check for status like (invitation pending) or (pending)
  const statusMatch = clean.match(/\((invitation\s+pending|pending|invited|substitute)\)/i);
  if (statusMatch && statusMatch[1]) {
    sourceStatus = statusMatch[1].toLowerCase().replace(/\s+/g, '_');
    clean = clean.replace(statusMatch[0], '').trim();
  }

  // Check for seed number like (10), (7), (6)
  const seedMatch = clean.match(/\((\d+)\)/);
  if (seedMatch && seedMatch[1]) {
    sourceSeed = parseInt(seedMatch[1], 10);
    clean = clean.replace(seedMatch[0], '').trim();
  }

  return { cleanName: clean, sourceSeed, sourceStatus };
}

/**
 * Normalize an alias string for deterministic comparison.
 * Trims, converts to lowercase, replaces multiple whitespace with single space,
 * and strips common diacritics.
 */
export function normalizeAlias(name: string): string {
  const { cleanName } = extractPlayerMetadata(name);
  return cleanName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculate similarity confidence between two normalized names.
 * Returns 1.0 for exact match, 0.85+ for diacritics/minor variations, lower for partial matches.
 */
export function calculateNameSimilarity(nameA: string, nameB: string): number {
  const normA = normalizeAlias(nameA);
  const normB = normalizeAlias(nameB);

  if (normA === normB) return 1.0;

  // Word set matching
  const wordsA = new Set(normA.split(' '));
  const wordsB = new Set(normB.split(' '));
  let common = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) common++;
  }
  const maxWords = Math.max(wordsA.size, wordsB.size);
  if (maxWords > 0 && common === maxWords) return 0.95;
  if (common >= 1 && maxWords <= 2) return 0.75;

  return 0.3;
}

export const NAME_NORMALIZATION_MAP: Record<string, string> = {
  // Alias y apodos específicos confirmados
  'jeipi': 'Juan Pedro González',
  'juan pedro': 'Juan Pedro González',
  'rick': 'Ricardo Mengíbar',
  'rick (7)': 'Ricardo Mengíbar',
  'ricardo mengibar': 'Ricardo Mengíbar',
  'pablis': 'Pablo Asín',
  'pabis (10)': 'Pablo Asín',
  'pabis': 'Pablo Asín',
  
  // Variantes Pablo Cascón / Gascón
  'pablo cascon': 'Pablo Cascón',
  'pablo cascon (10)': 'Pablo Cascón',
  'pablo gascon': 'Pablo Cascón',
  'pablo gascon (10)': 'Pablo Cascón',
  
  // Diminutivos y variaciones familiares
  'nacho escudero': 'Ignacio Escudero',
  'fer escudero': 'Fernando Escudero',
  'fernando': 'Fernando Escudero', // En contexto de actas 2026 GD
  'javi benito': 'Javier Benito',
  'jaime benito': 'Javier Benito',
  'javi clemente': 'Javier Clemente',
  'santi teran': 'Santiago Terán',
  'santi teheran': 'Santiago Terán',
  'santiago teran': 'Santiago Terán',
  'isa planas': 'Isabel Planas',
  'isabel planas': 'Isabel Planas',
  'miguel dr': 'Miguel de Rodrigo',
  'manu de rodrigo': 'Miguel de Rodrigo',
  'teran padre': 'Javier Terán',
  'javier teran': 'Javier Terán',
  'javier fdz': 'Javier Fernández',
  'gonzalez lopez': 'Gonzalo López',
  'gonzález lópez': 'Gonzalo López',
  'gonzalo lopez': 'Gonzalo López',
  
  // Nombres simples en actas de categorías infantiles
  'max': 'Max Cordero',
  'giles': 'Giles Corballe',
  'oliver': 'Oliver Rivero',
  'nico alonso': 'Nicolás Alonso',
  'milo herran': 'Milo de la Herrán',
  'milo de la herran': 'Milo de la Herrán',
  'alvaro herran': 'Álvaro de la Herrán',
  'alvaro de la herran': 'Álvaro de la Herrán',
  'alvaro barbera': 'Álvaro Barbera',
  'alvaro guerra': 'Álvaro Guerra',
  'alvaro sarmiento': 'Álvaro Sarmiento',
  'alvaro herrero': 'Álvaro Herrero',
  
  // Erratas tipográficas y actas específicas
  'isaac perid': 'Isaac Peris',
  'miguel angel': 'Miguel Ángel Martínez',
  'miguel angel martinez': 'Miguel Ángel Martínez',
  'ignacio': 'Ignacio Betherod', // En contexto de 2026 GA
  
  // Limpieza de números de siembra de Challonge
  'jorge clemente (7)': 'Jorge Clemente',
  'jose olalla (6)': 'José Félix Olalla',
  'lucia marin (6)': 'Lucía Marín',
  'xabier barrero (3)': 'Xabier Barrero',
  'jorge de la herran (3)': 'Jorge de la Herrán',
  'pablo olalla (10)': 'Pablo Olalla',
  'carlos rebellon (7)': 'Carlos Rebellón',
  'hector horcajada (8) (invitation pending)': 'Héctor Horcajada',
  'hector horcajada (8) (invi': 'Héctor Horcajada',
  'carlos ross (8)': 'Carlos Ross',
  'gonzalo penalver (3)': 'Gonzalo Peñalver',
  'gonzalo peñalver (3)': 'Gonzalo Peñalver',
  'sergio rebellon (5)': 'Sergio Rebellón',
  'ivan horcajada (8)': 'Iván Horcajada',
  
  // Perfiles independientes mantenidos tal cual
  'juan': 'Juan',
  'josechu': 'Josechu',
  'luli': 'Luli',
  'chamorro': 'Chamorro',
  'chamorro (9)': 'Chamorro',
  'lucas planas': 'Lucas Planas',
};

/**
 * Resolve a raw player name to its canonical name using NAME_NORMALIZATION_MAP,
 * metadata extraction, and alias normalization.
 */
export function resolveCanonicalPlayerName(rawName: string): string {
  const trimmed = rawName.trim();
  const lowerTrimmed = trimmed.toLowerCase();
  if (NAME_NORMALIZATION_MAP[lowerTrimmed]) {
    return NAME_NORMALIZATION_MAP[lowerTrimmed]!;
  }

  const { cleanName } = extractPlayerMetadata(trimmed);
  const lowerClean = cleanName.toLowerCase();
  if (NAME_NORMALIZATION_MAP[lowerClean]) {
    return NAME_NORMALIZATION_MAP[lowerClean]!;
  }

  const norm = normalizeAlias(cleanName);
  if (NAME_NORMALIZATION_MAP[norm]) {
    return NAME_NORMALIZATION_MAP[norm]!;
  }

  return cleanName;
}

/**
 * Resolve a player name to a canonical player ID with confidence and alias tracking.
 */
export function resolveOrCreatePlayer(
  rawName: string,
  playersMap: Map<string, CanonicalPlayer>,
  aliasesMap: Map<string, PlayerAlias>,
  sourceTournament?: string,
  idGenerator: () => string = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : '00000000-0000-4000-8000-' + Math.random().toString(16).slice(2, 14).padStart(12, '0')
): { player: CanonicalPlayer; alias: PlayerAlias; isNew: boolean } {
  const { cleanName, sourceSeed, sourceStatus } = extractPlayerMetadata(rawName);
  const canonicalTarget = resolveCanonicalPlayerName(rawName);
  const norm = normalizeAlias(cleanName);
  const canonicalNorm = normalizeAlias(canonicalTarget);
  const lowerRaw = rawName.toLowerCase().trim();

  // 1. Check direct alias mapping
  const existingAlias = aliasesMap.get(norm) || aliasesMap.get(lowerRaw);
  if (existingAlias) {
    const existingPlayer = playersMap.get(existingAlias.playerId);
    if (existingPlayer) {
      return { player: existingPlayer, alias: existingAlias, isNew: false };
    }
  }

  // 2. Check if canonical target or normalized name matches any canonical player name
  for (const player of playersMap.values()) {
    const pNorm = normalizeAlias(player.canonicalName);
    const sim = calculateNameSimilarity(player.canonicalName, canonicalTarget);
    if (pNorm === canonicalNorm || pNorm === norm || sim >= 0.9) {
      const now = new Date().toISOString();
      const alias: PlayerAlias = {
        id: idGenerator(),
        playerId: player.id,
        alias: rawName.trim(),
        normalizedAlias: norm,
        sourceSystem: 'historical_import',
        sourceTournament,
        sourceSeed,
        sourceStatus,
        confidence: sim,
        resolutionStatus: 'confirmed',
        createdAt: now,
      };
      aliasesMap.set(norm, alias);
      aliasesMap.set(lowerRaw, alias);
      return { player, alias, isNew: false };
    }
  }

  // 3. Create new canonical player
  const newPlayerId = idGenerator();
  const now = new Date().toISOString();
  const newPlayer: CanonicalPlayer = {
    id: newPlayerId,
    canonicalName: canonicalTarget,
    userId: null,
    createdAt: now,
    updatedAt: now,
  };

  const alias: PlayerAlias = {
    id: idGenerator(),
    playerId: newPlayerId,
    alias: rawName.trim(),
    normalizedAlias: norm,
    sourceSystem: 'historical_import',
    sourceTournament,
    sourceSeed,
    sourceStatus,
    confidence: 1.0,
    resolutionStatus: 'confirmed',
    createdAt: now,
  };

  playersMap.set(newPlayerId, newPlayer);
  aliasesMap.set(norm, alias);
  aliasesMap.set(lowerRaw, alias);

  return { player: newPlayer, alias, isNew: true };
}

/**
 * Parse raw historical match records into structured HistoricalTournament, HistoricalGroup, and HistoricalMatch entities.
 */
export function parseHistoricalRecords(
  records: RawHistoricalMatchRecord[],
  playersMap: Map<string, CanonicalPlayer>,
  aliasesMap: Map<string, PlayerAlias>,
  idGenerator: () => string = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : '00000000-0000-4000-8000-' + Math.random().toString(16).slice(2, 14).padStart(12, '0')
): HistoricalTournamentWithMatches[] {
  const tournamentsMap = new Map<string, {
    tournament: HistoricalTournament;
    groupsMap: Map<string, HistoricalGroup>;
    matches: HistoricalMatch[];
  }>();

  for (const rec of records) {
    const tourneyKey = `${rec.year}-${normalizeAlias(rec.tournamentName)}`;
    let tourneyEntry = tournamentsMap.get(tourneyKey);

    if (!tourneyEntry) {
      const tourneyId = idGenerator();
      const slug = `${rec.year}-${normalizeAlias(rec.tournamentName).replace(/\s+/g, '-')}`;
      const now = new Date().toISOString();
      const tourney: HistoricalTournament = {
        id: tourneyId,
        importId: null,
        name: rec.tournamentName,
        slug,
        year: rec.year,
        tournamentDate: rec.tournamentDate,
        location: null,
        createdAt: now,
      };

      tourneyEntry = {
        tournament: tourney,
        groupsMap: new Map(),
        matches: [],
      };
      tournamentsMap.set(tourneyKey, tourneyEntry);
    }

    // Resolve Group
    let groupId: string | null = null;
    if (rec.groupCode) {
      const code = rec.groupCode.toUpperCase().trim();
      let grp = tourneyEntry.groupsMap.get(code);
      if (!grp) {
        grp = {
          id: idGenerator(),
          historicalTournamentId: tourneyEntry.tournament.id,
          groupCode: code,
          expectedMatches: 0,
          createdAt: new Date().toISOString(),
        };
        tourneyEntry.groupsMap.set(code, grp);
      }
      grp.expectedMatches++;
      groupId = grp.id;
    }

    // Resolve Players
    const { player: p1 } = resolveOrCreatePlayer(rec.player1Name, playersMap, aliasesMap, rec.tournamentName, idGenerator);
    const { player: p2 } = resolveOrCreatePlayer(rec.player2Name, playersMap, aliasesMap, rec.tournamentName, idGenerator);

    let winnerId: string | null = null;
    let matchStatus: HistoricalMatchStatus = 'complete';

    if (rec.isMissing) {
      matchStatus = 'missing';
      winnerId = null;
    } else if (rec.score1 === rec.score2 && rec.score1 === 0) {
      matchStatus = 'missing';
      winnerId = null;
    } else {
      winnerId = rec.score1 > rec.score2 ? p1.id : p2.id;
    }

    const match: HistoricalMatch = {
      id: idGenerator(),
      historicalTournamentId: tourneyEntry.tournament.id,
      historicalGroupId: groupId,
      stage: rec.stage,
      player1Id: p1.id,
      player2Id: p2.id,
      player1SourceName: rec.player1Name,
      player2SourceName: rec.player2Name,
      scorePlayer1: rec.score1,
      scorePlayer2: rec.score2,
      winnerId,
      status: matchStatus,
      matchDate: rec.tournamentDate,
      sourceRecord: { ...rec },
      createdAt: new Date().toISOString(),
    };

    tourneyEntry.matches.push(match);
  }

  return Array.from(tournamentsMap.values()).map((entry) => ({
    tournament: entry.tournament,
    groups: Array.from(entry.groupsMap.values()),
    matches: entry.matches,
  }));
}

/**
 * Replay historical tournaments in strict chronological order and compute Glicko-2 ratings.
 * Generates an immutable rating snapshot after each tournament and tracks player rating states.
 * Only complete matches with confirmed identities are processed for ratings.
 */
export function replayHistoricalTournaments(
  tournamentDataList: HistoricalTournamentWithMatches[],
  existingRatingStates: Map<string, RatingState> = new Map(),
  aliasesMap?: Map<string, PlayerAlias>,
  idGenerator: () => string = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : '00000000-0000-4000-8000-' + Math.random().toString(16).slice(2, 14).padStart(12, '0')
): HistoricalReplayResult {
  // Sort tournaments strictly by date / year ascending
  const sortedTournaments = [...tournamentDataList].sort((a, b) => {
    const dateA = new Date(a.tournament.tournamentDate).getTime() || a.tournament.year;
    const dateB = new Date(b.tournament.tournamentDate).getTime() || b.tournament.year;
    return dateA - dateB;
  });

  const ratingStates = new Map<string, RatingState>(existingRatingStates);
  const snapshots: RatingSnapshot[] = [];
  let totalProcessedMatches = 0;
  let totalMissingMatches = 0;

  for (const tourneyData of sortedTournaments) {
    const { tournament, matches } = tourneyData;

    // Filter only complete matches
    const completeMatches = matches.filter((m) => m.status === 'complete');
    const missingMatches = matches.filter((m) => m.status === 'missing');
    totalMissingMatches += missingMatches.length;
    totalProcessedMatches += completeMatches.length;

    // Collect all players participating in this tournament with confirmed identity
    const participantIds = new Set<string>();
    for (const m of completeMatches) {
      participantIds.add(m.player1Id);
      participantIds.add(m.player2Id);
    }

    // Capture ratings before this tournament
    const ratingsBefore = new Map<string, PlayerRating>();
    for (const pid of participantIds) {
      const state = ratingStates.get(pid);
      if (state) {
        ratingsBefore.set(pid, {
          rating: state.rating,
          ratingDeviation: state.ratingDeviation,
          volatility: state.volatility,
          matchesPlayed: state.matchesPlayed,
        });
      } else {
        ratingsBefore.set(pid, initialRating());
      }
    }

    // Build match results per player for this rating period
    const playerResultsMap = new Map<string, RatingMatchResult[]>();
    for (const pid of participantIds) {
      playerResultsMap.set(pid, []);
    }

    for (const match of completeMatches) {
      if (!match.winnerId) continue;
      const p1Rating = ratingsBefore.get(match.player1Id) ?? initialRating();
      const p2Rating = ratingsBefore.get(match.player2Id) ?? initialRating();

      const p1Score: 1 | 0 = match.winnerId === match.player1Id ? 1 : 0;
      const p2Score: 1 | 0 = match.winnerId === match.player2Id ? 1 : 0;

      playerResultsMap.get(match.player1Id)?.push({
        opponent: p2Rating,
        score: p1Score,
      });

      playerResultsMap.get(match.player2Id)?.push({
        opponent: p1Rating,
        score: p2Score,
      });
    }

    // Calculate updated rating and generate snapshot for each player in this tournament
    const now = new Date().toISOString();

    for (const pid of participantIds) {
      const prevRating = ratingsBefore.get(pid)!;
      const results = playerResultsMap.get(pid) ?? [];
      const updated = updateRating(prevRating, results);

      const snapshot: RatingSnapshot = {
        id: idGenerator(),
        playerId: pid,
        ratingPeriodId: tournament.id,
        periodType: 'historical_tournament',
        ratingBefore: prevRating.rating,
        rdBefore: prevRating.ratingDeviation,
        volBefore: prevRating.volatility,
        ratingAfter: updated.rating,
        rdAfter: updated.ratingDeviation,
        volAfter: updated.volatility,
        matchesInPeriod: results.length,
        calculatedAt: now,
      };
      snapshots.push(snapshot);

      ratingStates.set(pid, {
        playerId: pid,
        rating: updated.rating,
        ratingDeviation: updated.ratingDeviation,
        volatility: updated.volatility,
        matchesPlayed: updated.matchesPlayed,
        lastCalculatedAt: now,
        updatedAt: now,
      });
    }
  }

  return {
    ratingStates,
    snapshots,
    processedTournamentsCount: sortedTournaments.length,
    processedMatchesCount: totalProcessedMatches,
    missingMatchesCount: totalMissingMatches,
  };
}

/** Player Historical Performance by Season */
export interface PlayerSeasonPerformance {
  season: number;
  tournamentName: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  pointsDiff: number;
  endOfSeasonRating: number;
  endOfSeasonRD: number;
}

/** Complete Player Historical Profile Timeline */
export interface PlayerHistoricalTimeline {
  playerId: string;
  canonicalName: string;
  currentRating: number;
  currentRD: number;
  currentVolatility: number;
  totalMatches: number;
  totalWins: number;
  totalLosses: number;
  winRate: number;
  seasons: PlayerSeasonPerformance[];
  ratingProgression: { season: number; rating: number }[];
}

/**
 * Compute the complete historical timeline for a player across all seasons.
 */
export function getPlayerHistoricalTimeline(
  playerId: string,
  canonicalPlayer: CanonicalPlayer,
  tournamentsWithMatches: HistoricalTournamentWithMatches[],
  ratingSnapshots: RatingSnapshot[],
  currentRatingState?: RatingState
): PlayerHistoricalTimeline {
  const seasons: PlayerSeasonPerformance[] = [];
  const ratingProgression: { season: number; rating: number }[] = [];

  let totalMatches = 0;
  let totalWins = 0;
  let totalLosses = 0;

  for (const tourneyData of tournamentsWithMatches) {
    const { tournament, matches } = tourneyData;
    const playerMatches = matches.filter(
      (m) => (m.player1Id === playerId || m.player2Id === playerId) && m.status === 'complete'
    );

    if (playerMatches.length === 0) continue;

    let wins = 0;
    let losses = 0;
    let pf = 0;
    let pa = 0;

    for (const m of playerMatches) {
      const isP1 = m.player1Id === playerId;
      const myScore = isP1 ? m.scorePlayer1 : m.scorePlayer2;
      const oppScore = isP1 ? m.scorePlayer2 : m.scorePlayer1;
      pf += myScore;
      pa += oppScore;

      if (m.winnerId === playerId) wins++;
      else losses++;
    }

    totalMatches += playerMatches.length;
    totalWins += wins;
    totalLosses += losses;

    const snap = ratingSnapshots.find(
      (s) => s.playerId === playerId && s.ratingPeriodId === tournament.id
    );

    const endRating = snap ? snap.ratingAfter : (currentRatingState?.rating ?? DEFAULT_RATING);
    const endRD = snap ? snap.rdAfter : (currentRatingState?.ratingDeviation ?? DEFAULT_RATING_DEVIATION);

    seasons.push({
      season: tournament.year,
      tournamentName: tournament.name,
      matchesPlayed: playerMatches.length,
      wins,
      losses,
      pointsFor: pf,
      pointsAgainst: pa,
      pointsDiff: pf - pa,
      endOfSeasonRating: endRating,
      endOfSeasonRD: endRD,
    });

    ratingProgression.push({
      season: tournament.year,
      rating: endRating,
    });
  }

  const winRate = totalMatches > 0 ? Math.round((totalWins / totalMatches) * 100) : 0;

  return {
    playerId,
    canonicalName: canonicalPlayer.canonicalName,
    currentRating: currentRatingState?.rating ?? DEFAULT_RATING,
    currentRD: currentRatingState?.ratingDeviation ?? DEFAULT_RATING_DEVIATION,
    currentVolatility: currentRatingState?.volatility ?? DEFAULT_VOLATILITY,
    totalMatches,
    totalWins,
    totalLosses,
    winRate,
    seasons,
    ratingProgression,
  };
}

/** Diagnostic Issue in Historical Dataset */
export interface HistoricalDiagnosticIssue {
  type: 'duplicate_match' | 'missing_match' | 'unresolved_alias' | 'incomplete_group' | 'unexpected_score';
  severity: 'warning' | 'error';
  season: number;
  groupCode?: string;
  description: string;
  remedy: string;
}

/**
 * Run diagnostic checks on historical data.
 */
export function diagnoseHistoricalData(
  tournamentsData: HistoricalTournamentWithMatches[],
  aliases: PlayerAlias[]
): HistoricalDiagnosticIssue[] {
  const issues: HistoricalDiagnosticIssue[] = [];

  // Check aliases for probable or unresolved states
  for (const alias of aliases) {
    if (alias.resolutionStatus !== 'confirmed') {
      issues.push({
        type: 'unresolved_alias',
        severity: 'warning',
        season: 0,
        description: `Alias "${alias.alias}" has ${alias.resolutionStatus} resolution status (confidence: ${(alias.confidence * 100).toFixed(0)}%).`,
        remedy: 'Confirm or separate this player identity in the Admin Identity Resolution dashboard.',
      });
    }
  }

  // Check matches in each tournament
  for (const t of tournamentsData) {
    const missingMatches = t.matches.filter((m) => m.status === 'missing');
    for (const m of missingMatches) {
      issues.push({
        type: 'missing_match',
        severity: 'warning',
        season: t.tournament.year,
        description: `Missing match between "${m.player1SourceName}" and "${m.player2SourceName}" in Group ${t.groups.find((g) => g.id === m.historicalGroupId)?.groupCode ?? '?'}.`,
        remedy: 'Record is explicitly marked as missing. Will not block other matches but group remains incomplete.',
      });
    }

    // Check for duplicate match pairings
    const pairSet = new Set<string>();
    for (const m of t.matches) {
      const key = [m.player1Id, m.player2Id].sort().join('--');
      if (pairSet.has(key)) {
        issues.push({
          type: 'duplicate_match',
          severity: 'error',
          season: t.tournament.year,
          description: `Duplicate match pairing detected between ${m.player1SourceName} and ${m.player2SourceName}.`,
          remedy: 'Remove or consolidate the duplicate match entry.',
        });
      }
      pairSet.add(key);
    }
  }

  return issues;
}
