import { describe, it, expect } from 'vitest';
import {
  normalizeAlias,
  extractPlayerMetadata,
  calculateNameSimilarity,
  resolveOrCreatePlayer,
  parseHistoricalRecords,
  replayHistoricalTournaments,
  getPlayerHistoricalTimeline,
  diagnoseHistoricalData,
  NAME_NORMALIZATION_MAP,
  resolveCanonicalPlayerName,
  type CanonicalPlayer,
  type PlayerAlias,
  type RawHistoricalMatchRecord,
} from '../../lib/engine/historical';
import {
  HISTORICAL_2024_MATCHES,
  HISTORICAL_2025_MATCHES,
  HISTORICAL_2026_MATCHES,
  getHistoricalSeasonSummaries,
} from '../../lib/data';
import { DEFAULT_RATING } from '../../lib/engine/constants';

describe('Historical Archive Engine', () => {
  describe('extractPlayerMetadata', () => {
    it('should extract seed numbers in parentheses without corrupting name', () => {
      const res1 = extractPlayerMetadata('Pablo Gascon (10)');
      expect(res1.cleanName).toBe('Pablo Gascon');
      expect(res1.sourceSeed).toBe(10);
      expect(res1.sourceStatus).toBeNull();

      const res2 = extractPlayerMetadata('Jorge Clemente (7)');
      expect(res2.cleanName).toBe('Jorge Clemente');
      expect(res2.sourceSeed).toBe(7);

      const res3 = extractPlayerMetadata('José Olalla (6)');
      expect(res3.cleanName).toBe('José Olalla');
      expect(res3.sourceSeed).toBe(6);
    });

    it('should extract seed and invitation pending status correctly', () => {
      const res = extractPlayerMetadata('Héctor Horcajada (8) (invitation pending)');
      expect(res.cleanName).toBe('Héctor Horcajada');
      expect(res.sourceSeed).toBe(8);
      expect(res.sourceStatus).toBe('invitation_pending');
    });

    it('should leave plain names untouched', () => {
      const res = extractPlayerMetadata('Xabier Barrero');
      expect(res.cleanName).toBe('Xabier Barrero');
      expect(res.sourceSeed).toBeNull();
      expect(res.sourceStatus).toBeNull();
    });
  });

  describe('normalizeAlias & calculateNameSimilarity', () => {
    it('should normalize whitespace, casing, and diacritics', () => {
      expect(normalizeAlias('  Guillermo   Ramos  ')).toBe('guillermo ramos');
      expect(normalizeAlias('Álvaro Peña')).toBe('alvaro pena');
      expect(normalizeAlias('JOSÉ MARÍA')).toBe('jose maria');
      expect(normalizeAlias('Pablo Gascon (10)')).toBe('pablo gascon');
    });

    it('should detect high similarity for minor accent variations', () => {
      expect(calculateNameSimilarity('Lucas Rebellon', 'Lucas Rebellón')).toBe(1.0);
      expect(calculateNameSimilarity('Pablo Gascon', 'Pablo Gascón')).toBe(1.0);
    });
  });

  describe('resolveOrCreatePlayer', () => {
    it('should create a new canonical player and alias on first encounter', () => {
      const playersMap = new Map<string, CanonicalPlayer>();
      const aliasesMap = new Map<string, PlayerAlias>();

      const res1 = resolveOrCreatePlayer('Carlos Sainz', playersMap, aliasesMap, 'Torneo 2024', () => 'p-1');
      expect(res1.isNew).toBe(true);
      expect(res1.player.id).toBe('p-1');
      expect(res1.player.canonicalName).toBe('Carlos Sainz');
      expect(res1.alias.resolutionStatus).toBe('confirmed');
      expect(playersMap.size).toBe(1);
    });

    it('should resolve aliases with source metadata without polluting canonical identity', () => {
      const playersMap = new Map<string, CanonicalPlayer>();
      const aliasesMap = new Map<string, PlayerAlias>();

      const res1 = resolveOrCreatePlayer('Pablo Gascon (10)', playersMap, aliasesMap, 'Torneo 2024', () => 'p-1');
      expect(res1.player.canonicalName).toBe('Pablo Cascón');
      expect(res1.alias.sourceSeed).toBe(10);

      const res2 = resolveOrCreatePlayer('Pablo Gascon', playersMap, aliasesMap, 'Torneo 2025', () => 'p-2');
      expect(res2.isNew).toBe(false);
      expect(res2.player.id).toBe('p-1');
      expect(playersMap.size).toBe(1);
    });
  });

  describe('Real Historical 2024 Dataset (63 matches, 3 groups of 7)', () => {
    it('should contain exactly 63 matches across 3 groups of 7 players', () => {
      const playersMap = new Map<string, CanonicalPlayer>();
      const aliasesMap = new Map<string, PlayerAlias>();

      const rawRecords: RawHistoricalMatchRecord[] = HISTORICAL_2024_MATCHES.map((m) => ({
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

      const parsed = parseHistoricalRecords(rawRecords, playersMap, aliasesMap);
      expect(parsed.length).toBe(1);
      const tourney = parsed[0]!;

      expect(tourney.tournament.year).toBe(2024);
      expect(tourney.groups.length).toBe(3); // Groups A, B, C
      expect(tourney.matches.length).toBe(63); // 21 + 21 + 21 matches
      expect(playersMap.size).toBe(21); // 21 canonical players

      // Verify each group has 21 matches
      const grpA = tourney.groups.find((g) => g.groupCode === 'A');
      const grpB = tourney.groups.find((g) => g.groupCode === 'B');
      const grpC = tourney.groups.find((g) => g.groupCode === 'C');

      expect(tourney.matches.filter((m) => m.historicalGroupId === grpA?.id).length).toBe(21);
      expect(tourney.matches.filter((m) => m.historicalGroupId === grpB?.id).length).toBe(21);
      expect(tourney.matches.filter((m) => m.historicalGroupId === grpC?.id).length).toBe(21);
    });
  });

  describe('Real Historical 2025 Dataset (91 matches, 4 groups)', () => {
    it('should contain exactly 91 matches across 4 groups (8, 7, 7, 7 players)', () => {
      const playersMap = new Map<string, CanonicalPlayer>();
      const aliasesMap = new Map<string, PlayerAlias>();

      const rawRecords: RawHistoricalMatchRecord[] = HISTORICAL_2025_MATCHES.map((m) => ({
        tournamentName: m.tournamentName,
        year: m.season,
        tournamentDate: m.tournamentDate,
        stage: 'group',
        groupCode: m.groupCode,
        player1Name: m.player1Raw,
        player2Name: m.player2Raw,
        score1: m.score1,
        score2: m.score2,
      }));

      const parsed = parseHistoricalRecords(rawRecords, playersMap, aliasesMap);
      const tourney = parsed[0]!;

      expect(tourney.tournament.year).toBe(2025);
      expect(tourney.groups.length).toBe(4);
      expect(tourney.matches.length).toBe(91); // 28 + 21 + 21 + 21
      expect(playersMap.size).toBe(29);
    });
  });

  describe('Real Historical 2026 Dataset (59 supplied + 1 missing = 60 expected)', () => {
    it('should contain 59 complete matches and explicitly track 1 missing match in Group A', () => {
      const playersMap = new Map<string, CanonicalPlayer>();
      const aliasesMap = new Map<string, PlayerAlias>();

      const rawRecords: RawHistoricalMatchRecord[] = HISTORICAL_2026_MATCHES.map((m) => ({
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

      const parsed = parseHistoricalRecords(rawRecords, playersMap, aliasesMap);
      const tourney = parsed[0]!;

      expect(tourney.tournament.year).toBe(2026);
      expect(tourney.groups.length).toBe(4); // A, B, C, D
      expect(tourney.matches.length).toBe(60); // 15 * 4 = 60 total records

      const completeMatches = tourney.matches.filter((m) => m.status === 'complete');
      const missingMatches = tourney.matches.filter((m) => m.status === 'missing');

      expect(completeMatches.length).toBe(59);
      expect(missingMatches.length).toBe(1);
      expect(missingMatches[0]?.player1SourceName).toBe('Carlos Ross');
      expect(missingMatches[0]?.player2SourceName).toBe('Lucia Marin');

      // Check season summary
      const summaries = getHistoricalSeasonSummaries();
      const s2026 = summaries.find((s) => s.season === 2026);
      expect(s2026?.isComplete).toBe(false); // Incomplete due to missing match!
      expect(s2026?.suppliedMatches).toBe(59);
      expect(s2026?.missingMatches).toBe(1);
    });
  });

  describe('Chronological Replay (2024 -> 2025 -> 2026)', () => {
    it('should replay all 3 seasons sequentially and track rating progression', () => {
      const playersMap = new Map<string, CanonicalPlayer>();
      const aliasesMap = new Map<string, PlayerAlias>();

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

      const parsedTournaments = parseHistoricalRecords(allRecords, playersMap, aliasesMap);
      const replay = replayHistoricalTournaments(parsedTournaments);

      expect(replay.processedTournamentsCount).toBe(3);
      expect(replay.processedMatchesCount).toBe(63 + 91 + 59); // 213 complete matches
      expect(replay.missingMatchesCount).toBe(1); // 1 missing match in 2026

      // Pablo Cascón played across multiple seasons -> check his progression
      const pablo = Array.from(playersMap.values()).find((p) => p.canonicalName === 'Pablo Cascón')!;
      expect(pablo).toBeDefined();

      const timeline = getPlayerHistoricalTimeline(
        pablo.id,
        pablo,
        parsedTournaments,
        replay.snapshots,
        replay.ratingStates.get(pablo.id)
      );

      expect(timeline.seasons.length).toBe(3); // 2024, 2025, 2026
      expect(timeline.ratingProgression.length).toBe(3);
      expect(timeline.totalMatches).toBeGreaterThan(15);
      expect(timeline.totalWins).toBeGreaterThan(10);
    });

    it('should diagnose missing matches and data quality warnings', () => {
      const playersMap = new Map<string, CanonicalPlayer>();
      const aliasesMap = new Map<string, PlayerAlias>();

      const allRecords: RawHistoricalMatchRecord[] = [
        ...HISTORICAL_2024_MATCHES,
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

      const parsed = parseHistoricalRecords(allRecords, playersMap, aliasesMap);
      const issues = diagnoseHistoricalData(parsed, Array.from(aliasesMap.values()));

      const missingIssues = issues.filter((i) => i.type === 'missing_match');
      expect(missingIssues.length).toBe(1);
      expect(missingIssues[0]?.season).toBe(2026);
    });
  });

  describe('Canonical Name Normalization Map (NAME_NORMALIZATION_MAP)', () => {
    it('normalizes confirmed aliases and nicknames', () => {
      expect(resolveCanonicalPlayerName('jeipi')).toBe('Juan Pedro González');
      expect(resolveCanonicalPlayerName('juan pedro')).toBe('Juan Pedro González');
      expect(resolveCanonicalPlayerName('rick')).toBe('Ricardo Mengíbar');
      expect(resolveCanonicalPlayerName('rick (7)')).toBe('Ricardo Mengíbar');
      expect(resolveCanonicalPlayerName('ricardo mengibar')).toBe('Ricardo Mengíbar');
      expect(resolveCanonicalPlayerName('pablis')).toBe('Pablo Asín');
      expect(resolveCanonicalPlayerName('pabis (10)')).toBe('Pablo Asín');
      expect(resolveCanonicalPlayerName('pabis')).toBe('Pablo Asín');
    });

    it('normalizes Pablo Cascón / Gascón variants to Pablo Cascón', () => {
      expect(resolveCanonicalPlayerName('pablo cascon')).toBe('Pablo Cascón');
      expect(resolveCanonicalPlayerName('pablo cascon (10)')).toBe('Pablo Cascón');
      expect(resolveCanonicalPlayerName('pablo gascon')).toBe('Pablo Cascón');
      expect(resolveCanonicalPlayerName('pablo gascon (10)')).toBe('Pablo Cascón');
    });

    it('normalizes family variants and diminutives', () => {
      expect(resolveCanonicalPlayerName('nacho escudero')).toBe('Ignacio Escudero');
      expect(resolveCanonicalPlayerName('fer escudero')).toBe('Fernando Escudero');
      expect(resolveCanonicalPlayerName('fernando')).toBe('Fernando Escudero');
      expect(resolveCanonicalPlayerName('javi benito')).toBe('Javier Benito');
      expect(resolveCanonicalPlayerName('jaime benito')).toBe('Javier Benito');
      expect(resolveCanonicalPlayerName('javi clemente')).toBe('Javier Clemente');
      expect(resolveCanonicalPlayerName('santi teran')).toBe('Santiago Terán');
      expect(resolveCanonicalPlayerName('santi teheran')).toBe('Santiago Terán');
      expect(resolveCanonicalPlayerName('santiago teran')).toBe('Santiago Terán');
      expect(resolveCanonicalPlayerName('isa planas')).toBe('Isabel Planas');
      expect(resolveCanonicalPlayerName('isabel planas')).toBe('Isabel Planas');
      expect(resolveCanonicalPlayerName('miguel dr')).toBe('Miguel de Rodrigo');
      expect(resolveCanonicalPlayerName('manu de rodrigo')).toBe('Miguel de Rodrigo');
      expect(resolveCanonicalPlayerName('teran padre')).toBe('Javier Terán');
      expect(resolveCanonicalPlayerName('javier teran')).toBe('Javier Terán');
      expect(resolveCanonicalPlayerName('javier fdz')).toBe('Javier Fernández');
      expect(resolveCanonicalPlayerName('gonzalez lopez')).toBe('Gonzalo López');
      expect(resolveCanonicalPlayerName('gonzález lópez')).toBe('Gonzalo López');
      expect(resolveCanonicalPlayerName('gonzalo lopez')).toBe('Gonzalo López');
    });

    it('normalizes junior and single-name records', () => {
      expect(resolveCanonicalPlayerName('max')).toBe('Max Cordero');
      expect(resolveCanonicalPlayerName('giles')).toBe('Giles Corballe');
      expect(resolveCanonicalPlayerName('oliver')).toBe('Oliver Rivero');
      expect(resolveCanonicalPlayerName('nico alonso')).toBe('Nicolás Alonso');
      expect(resolveCanonicalPlayerName('milo herran')).toBe('Milo de la Herrán');
      expect(resolveCanonicalPlayerName('milo de la herran')).toBe('Milo de la Herrán');
      expect(resolveCanonicalPlayerName('alvaro herran')).toBe('Álvaro de la Herrán');
      expect(resolveCanonicalPlayerName('alvaro de la herran')).toBe('Álvaro de la Herrán');
      expect(resolveCanonicalPlayerName('alvaro barbera')).toBe('Álvaro Barbera');
      expect(resolveCanonicalPlayerName('alvaro guerra')).toBe('Álvaro Guerra');
      expect(resolveCanonicalPlayerName('alvaro sarmiento')).toBe('Álvaro Sarmiento');
      expect(resolveCanonicalPlayerName('alvaro herrero')).toBe('Álvaro Herrero');
    });

    it('normalizes typos and seeds from Challonge', () => {
      expect(resolveCanonicalPlayerName('isaac perid')).toBe('Isaac Peris');
      expect(resolveCanonicalPlayerName('miguel angel')).toBe('Miguel Ángel Martínez');
      expect(resolveCanonicalPlayerName('miguel angel martinez')).toBe('Miguel Ángel Martínez');
      expect(resolveCanonicalPlayerName('ignacio')).toBe('Ignacio Betherod');
      expect(resolveCanonicalPlayerName('jorge clemente (7)')).toBe('Jorge Clemente');
      expect(resolveCanonicalPlayerName('jose olalla (6)')).toBe('José Félix Olalla');
      expect(resolveCanonicalPlayerName('lucia marin (6)')).toBe('Lucía Marín');
      expect(resolveCanonicalPlayerName('xabier barrero (3)')).toBe('Xabier Barrero');
      expect(resolveCanonicalPlayerName('jorge de la herran (3)')).toBe('Jorge de la Herrán');
      expect(resolveCanonicalPlayerName('pablo olalla (10)')).toBe('Pablo Olalla');
      expect(resolveCanonicalPlayerName('carlos rebellon (7)')).toBe('Carlos Rebellón');
      expect(resolveCanonicalPlayerName('hector horcajada (8) (invitation pending)')).toBe('Héctor Horcajada');
      expect(resolveCanonicalPlayerName('carlos ross (8)')).toBe('Carlos Ross');
      expect(resolveCanonicalPlayerName('gonzalo penalver (3)')).toBe('Gonzalo Peñalver');
      expect(resolveCanonicalPlayerName('sergio rebellon (5)')).toBe('Sergio Rebellón');
      expect(resolveCanonicalPlayerName('ivan horcajada (8)')).toBe('Iván Horcajada');
    });

    it('preserves standalone distinct profiles', () => {
      expect(resolveCanonicalPlayerName('juan')).toBe('Juan');
      expect(resolveCanonicalPlayerName('josechu')).toBe('Josechu');
      expect(resolveCanonicalPlayerName('luli')).toBe('Luli');
      expect(resolveCanonicalPlayerName('chamorro')).toBe('Chamorro');
      expect(resolveCanonicalPlayerName('chamorro (9)')).toBe('Chamorro');
      expect(resolveCanonicalPlayerName('lucas planas')).toBe('Lucas Planas');
    });
  });
});
