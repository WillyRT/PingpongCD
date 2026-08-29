import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import {
  MASTER_PLAYER_NAMES,
  getAllMasterHistoricalMatches,
} from '../lib/data/master-history';
import {
  parseHistoricalRecords,
  replayHistoricalTournaments,
  type CanonicalPlayer,
  type PlayerAlias,
} from '../lib/engine/historical';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const secretKey =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  '';

if (!supabaseUrl || !secretKey) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, secretKey, {
  auth: { persistSession: false },
});

function deterministicUUID(input: string): string {
  const hash = createHash('sha256').update(input).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

// Map player categories
const SUB14_PLAYERS = new Set([
  'Claudia Terán', 'Ignacio Betherod', 'Yago Fernández', 'Santi Terán', 'Isa Planas', 'Fernando Planas',
  'Miguel de Rodrigo', 'Lucas Planas', 'Terán padre', 'Jaime Pérez', 'Miguel Ángel Martínez', 'Gonzalo López',
  'Javier Fernández', 'Alan Esteban', 'Pablo Benito', 'Marcos Arias', 'Nico Alonso', 'Alejandra Escudero',
  'Jaime Ros', 'Miguel Ros', 'Ignacio Escudero', 'Milo Herrán', 'Jaime León', 'Javier Ros',
  'Diego Navarrete', 'Nacho Escudero', 'Gonzalo Cordero', 'Max', 'Max Cordero', 'Juan Pedro Lovelle', 'Jaime España',
  'Nicolás López', 'Álvaro Herrero', 'Juan Aranaz', 'Guillermo Fraile', 'Rafael Tejedor', 'Gabriel Fernández',
  'Jaime Navarrete', 'Álvaro Barbera', 'Pablo Luengo', 'Álvaro Guerra', 'Álvaro de la Herrán', 'Blanca Barbera',
  'Sofía Fernández', 'Carmen Navarrete', 'Jaime Fernández', 'Miguel Ausejo', 'Claudio Lora', 'Arturo Benito',
  'Alonso Gaviño', 'Ana Arias', 'Jaime Guerra', 'Miguel Rodríguez', 'Ana Benito', 'Martín Alonso', 'Oliver Rivero',
  'Cristina Martínez', 'Carmen Martínez', 'Giles Corballe'
]);

async function runMasterSeed() {
  console.log('===========================================================');
  console.log('🚀 TOURNEYMASTER AI: MASTER HISTORICAL SEED (2023 - 2026)');
  console.log('===========================================================');
  console.log('Connecting to:', supabaseUrl);

  // 1. Clean previous database records safely in foreign key order
  console.log('\n🧹 Cleaning previous database records...');
  await supabase.from('rating_snapshots').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('rating_states').delete().neq('player_id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('historical_matches').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('historical_groups').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('historical_tournaments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('player_aliases').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('players').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('Previous historical archive cleared cleanly.');

  // 2. Consolidate and Register Unique Profiles & Canonical Players
  console.log(`\n👥 Registering ${MASTER_PLAYER_NAMES.length} canonical players & profiles...`);
  const playersMap = new Map<string, CanonicalPlayer>();
  const aliasesMap = new Map<string, PlayerAlias>();
  const playerNameToId = new Map<string, string>();

  const profileRows = [];
  const playerRows = [];
  const aliasRows = [];

  for (const rawName of MASTER_PLAYER_NAMES) {
    const cleanName = rawName.trim();
    const playerId = deterministicUUID(`player-${cleanName.toLowerCase()}`);
    playerNameToId.set(cleanName.toLowerCase(), playerId);

    const isSub14 = SUB14_PLAYERS.has(cleanName);
    const category = isSub14 ? 'sub14' : 'plus14';

    const playerObj: CanonicalPlayer = {
      id: playerId,
      canonicalName: cleanName,
      userId: playerId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    playersMap.set(playerId, playerObj);

    const aliasId = deterministicUUID(`alias-${cleanName.toLowerCase()}`);
    const aliasObj: PlayerAlias = {
      id: aliasId,
      playerId,
      alias: cleanName,
      normalizedAlias: cleanName.toLowerCase(),
      sourceSystem: 'master_history',
      confidence: 1.0,
      resolutionStatus: 'confirmed',
      createdAt: new Date().toISOString(),
    };
    aliasesMap.set(cleanName.toLowerCase(), aliasObj);

    playerRows.push({
      id: playerId,
      canonical_name: cleanName,
      user_id: playerId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    aliasRows.push({
      id: aliasId,
      player_id: playerId,
      alias: cleanName,
      normalized_alias: cleanName.toLowerCase(),
      source_system: 'master_history',
      confidence: 1.0,
      created_at: new Date().toISOString(),
    });

    profileRows.push({
      id: playerId,
      name: cleanName,
      nickname: cleanName,
      email: `${cleanName.toLowerCase().replace(/\s+/g, '.').normalize('NFD').replace(/[\u0300-\u036f]/g, '')}@pingpong.cd`,
      role: 'player',
      admin_status: 'none',
      category,
      rating: 1500,
      rating_deviation: 350,
      volatility: 0.06,
      matches_played: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  // Batch insert into profiles (in chunks of 50)
  for (let i = 0; i < profileRows.length; i += 50) {
    const chunk = profileRows.slice(i, i + 50);
    const { error: pErr } = await supabase.from('profiles').upsert(chunk, { onConflict: 'id' });
    if (pErr) console.error('Error inserting profiles chunk:', pErr.message);
  }

  // Ensure superadmin role for guillermoriveraterriza@gmail.com
  await supabase
    .from('profiles')
    .update({ role: 'super_admin', admin_status: 'approved' })
    .eq('email', 'guillermoriveraterriza@gmail.com');

  // Insert players
  for (let i = 0; i < playerRows.length; i += 50) {
    const chunk = playerRows.slice(i, i + 50);
    const { error: plErr } = await supabase.from('players').upsert(chunk, { onConflict: 'id' });
    if (plErr) console.error('Error inserting players chunk:', plErr.message);
  }

  // Insert aliases
  for (let i = 0; i < aliasRows.length; i += 50) {
    const chunk = aliasRows.slice(i, i + 50);
    const { error: alErr } = await supabase.from('player_aliases').upsert(chunk, { onConflict: 'id' });
    if (alErr) console.error('Error inserting aliases chunk:', alErr.message);
  }

  console.log(`Saved ${playerRows.length} canonical players & profiles.`);

  // 3. Load All Master Historical Matches (2023 - 2026)
  const rawMatches = getAllMasterHistoricalMatches();
  console.log(`\n📋 Loaded ${rawMatches.length} raw historical match records across 8 tournaments.`);

  // 4. Parse Tournaments & Matches using deterministic UUIDs
  const parsedTournaments = parseHistoricalRecords(rawMatches, playersMap, aliasesMap, () => deterministicUUID(`uuid-${Math.random()}`));

  for (const t of parsedTournaments) {
    t.tournament.id = deterministicUUID(`tourney-${t.tournament.slug}`);
    for (const g of t.groups) {
      g.id = deterministicUUID(`group-${t.tournament.slug}-${g.groupCode}`);
      g.historicalTournamentId = t.tournament.id;
    }
    for (const m of t.matches) {
      m.historicalTournamentId = t.tournament.id;
      const grp = t.groups.find((g) => g.groupCode === (m.sourceRecord as any)?.groupCode);
      if (grp) m.historicalGroupId = grp.id;

      m.id = deterministicUUID(
        `match-${t.tournament.slug}-${(m.sourceRecord as any)?.groupCode}-${m.player1SourceName}-${m.player2SourceName}`
      );
    }
  }

  // 5. Insert Historical Tournaments & Groups
  console.log(`\n🏆 Inserting ${parsedTournaments.length} Historical Tournaments...`);
  for (const t of parsedTournaments) {
    const tourneyRow = {
      id: t.tournament.id,
      name: t.tournament.name,
      year: t.tournament.year,
      slug: t.tournament.slug,
      tournament_date: t.tournament.tournamentDate,
      is_complete: t.tournament.slug !== 'senior-cd-2026',
    };
    await supabase.from('historical_tournaments').upsert(tourneyRow, { onConflict: 'id' });

    // Also register in main tournaments table with status 'finished'
    await supabase.from('tournaments').upsert(
      {
        id: t.tournament.id,
        name: t.tournament.name,
        slug: t.tournament.slug,
        status: 'finished',
        hidden_standings: false,
        created_by: profileRows[0]?.id || '00000000-0000-0000-0000-000000000000',
        created_at: new Date(t.tournament.tournamentDate).toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );

    // Insert Groups
    for (const g of t.groups) {
      await supabase.from('historical_groups').upsert(
        {
          id: g.id,
          historical_tournament_id: t.tournament.id,
          group_code: g.groupCode,
          total_matches: g.expectedMatches,
          total_players: 0,
        },
        { onConflict: 'id' }
      );

      await supabase.from('tournament_groups').upsert(
        {
          id: g.id,
          tournament_id: t.tournament.id,
          group_letter: g.groupCode.slice(0, 1),
          category: t.tournament.name.toLowerCase().includes('sub') ? 'sub14' : 'plus14',
          status: 'completed',
          expected_matches: g.expectedMatches,
          completed_at: new Date(t.tournament.tournamentDate).toISOString(),
        },
        { onConflict: 'id' }
      );
    }
  }

  // 6. Insert All Matches
  console.log('\n🏓 Inserting all historical matches...');
  const allMatchesList = parsedTournaments.flatMap((t) => t.matches);
  const matchRows = allMatchesList.map((m) => ({
    id: m.id,
    historical_tournament_id: m.historicalTournamentId,
    group_id: m.historicalGroupId,
    stage: m.stage,
    player1_id: m.player1Id,
    player2_id: m.player2Id,
    score_player1: m.scorePlayer1,
    score_player2: m.scorePlayer2,
    winner_id: m.winnerId,
    status: m.status,
    is_missing: m.status === 'missing',
    played_at: m.matchDate ? new Date(m.matchDate).toISOString() : null,
  }));

  for (let i = 0; i < matchRows.length; i += 50) {
    const chunk = matchRows.slice(i, i + 50);
    const { error: mErr } = await supabase.from('historical_matches').upsert(chunk, { onConflict: 'id' });
    if (mErr) console.error('Error inserting matches chunk:', mErr.message);
  }
  console.log(`Inserted ${matchRows.length} historical matches successfully.`);

  // 7. Run Glicko-2 Rating Replay Chronologically (2023 -> 2024 -> 2025 -> 2026)
  console.log('\n📈 Calculating Chronological Glicko-2 Ratings & Snapshots...');
  const replayResult = replayHistoricalTournaments(
    parsedTournaments,
    new Map(),
    aliasesMap,
    () => deterministicUUID(`snap-${Math.random()}`)
  );

  console.log(`Processed ${replayResult.processedMatchesCount} matches for ratings across all periods.`);

  // Insert Rating Snapshots
  const snapshotRows = replayResult.snapshots.map((s) => ({
    id: deterministicUUID(`snapshot-${s.playerId}-${s.ratingPeriodId}`),
    player_id: s.playerId,
    historical_tournament_id: s.ratingPeriodId,
    rating_before: Math.round(s.ratingBefore * 10) / 10,
    rd_before: Math.round(s.rdBefore * 10) / 10,
    volatility_before: s.volBefore,
    rating_after: Math.round(s.ratingAfter * 10) / 10,
    rd_after: Math.round(s.rdAfter * 10) / 10,
    volatility_after: s.volAfter,
    matches_in_period: s.matchesInPeriod,
    wins_in_period: 0,
  }));

  for (let i = 0; i < snapshotRows.length; i += 50) {
    const chunk = snapshotRows.slice(i, i + 50);
    const { error: sErr } = await supabase.from('rating_snapshots').upsert(chunk, { onConflict: 'id' });
    if (sErr) console.error('Error inserting snapshots chunk:', sErr.message);
  }
  console.log(`Inserted ${snapshotRows.length} Glicko-2 rating snapshots.`);

  // Insert Rating States & Update Profiles
  const ratingStateRows = [];
  for (const [playerId, state] of replayResult.ratingStates.entries()) {
    ratingStateRows.push({
      player_id: playerId,
      rating: Math.round(state.rating * 10) / 10,
      rating_deviation: Math.round(state.ratingDeviation * 10) / 10,
      volatility: state.volatility,
      matches_played: state.matchesPlayed,
      updated_at: new Date().toISOString(),
    });

    // Update corresponding profile
    await supabase
      .from('profiles')
      .update({
        rating: Math.round(state.rating * 10) / 10,
        rating_deviation: Math.round(state.ratingDeviation * 10) / 10,
        volatility: state.volatility,
        matches_played: state.matchesPlayed,
      })
      .eq('id', playerId);
  }

  for (let i = 0; i < ratingStateRows.length; i += 50) {
    const chunk = ratingStateRows.slice(i, i + 50);
    const { error: rsErr } = await supabase.from('rating_states').upsert(chunk, { onConflict: 'player_id' });
    if (rsErr) console.error('Error inserting rating states chunk:', rsErr.message);
  }

  console.log(`Updated ${ratingStateRows.length} rating states and profile ratings.`);

  console.log('\n===========================================================');
  console.log('✅ MASTER SEED COMPLETED SUCCESSFULLY!');
  console.log(`Total Players: ${playerRows.length}`);
  console.log(`Total Tournaments: ${parsedTournaments.length}`);
  console.log(`Total Matches: ${matchRows.length}`);
  console.log(`Total Snapshots: ${snapshotRows.length}`);
  console.log('===========================================================');
}

runMasterSeed().catch((err) => {
  console.error('Fatal seed error:', err);
  process.exit(1);
});
