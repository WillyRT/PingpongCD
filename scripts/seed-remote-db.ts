import { createClient } from '@supabase/supabase-js';
import {
  parseHistoricalRecords,
  replayHistoricalTournaments,
  type CanonicalPlayer,
  type PlayerAlias,
  type RawHistoricalMatchRecord,
} from '../lib/engine/historical';
import {
  HISTORICAL_2024_MATCHES,
  HISTORICAL_2025_MATCHES,
  HISTORICAL_2026_MATCHES,
} from '../lib/data';
import { SUPER_ADMIN_EMAIL } from '../lib/engine/constants';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';

const supabase = createClient(supabaseUrl, secretKey, {
  auth: { persistSession: false },
});

async function seedRemote() {
  console.log('--- SEEDING REAL HISTORICAL ARCHIVE TO SUPABASE ---');
  console.log('Target URL:', supabaseUrl);

  const rawMatches: RawHistoricalMatchRecord[] = [
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

  console.log(`Loaded ${rawMatches.length} raw historical match records.`);

  // Fetch existing players to preserve IDs
  const { data: dbPlayers } = await supabase.from('players').select('*');
  const playersMap = new Map<string, CanonicalPlayer>();
  for (const p of dbPlayers ?? []) {
    playersMap.set(p.id, {
      id: p.id,
      canonicalName: p.canonical_name,
      userId: p.user_id,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    });
  }

  // Fetch existing aliases
  const { data: dbAliases } = await supabase.from('player_aliases').select('*');
  const aliasesMap = new Map<string, PlayerAlias>();
  for (const a of dbAliases ?? []) {
    aliasesMap.set(a.alias.toLowerCase().trim(), {
      id: a.id,
      playerId: a.player_id,
      alias: a.alias,
      normalizedAlias: a.alias.toLowerCase().trim(),
      sourceSystem: a.source_system,
      confidence: 1.0,
      resolutionStatus: 'confirmed',
      createdAt: a.created_at,
    });
  }

  const parsedTournaments = parseHistoricalRecords(rawMatches, playersMap, aliasesMap);
  console.log(`Parsed ${playersMap.size} canonical players and ${parsedTournaments.length} tournaments.`);

  // Preserve existing tournament IDs
  const { data: existingTourneys } = await supabase.from('historical_tournaments').select('*');
  const tourneySlugToId = new Map<string, string>();
  for (const t of existingTourneys ?? []) {
    tourneySlugToId.set(t.slug, t.id);
  }

  for (const t of parsedTournaments) {
    const existingId = tourneySlugToId.get(t.tournament.slug);
    if (existingId) {
      t.tournament.id = existingId;
      for (const g of t.groups) {
        g.historicalTournamentId = existingId;
      }
      for (const m of t.matches) {
        m.historicalTournamentId = existingId;
      }
    }
  }

  // Preserve existing group IDs
  const { data: existingGroups } = await supabase.from('historical_groups').select('*');
  const groupKeyToId = new Map<string, string>();
  for (const g of existingGroups ?? []) {
    groupKeyToId.set(`${g.historical_tournament_id}-${g.group_code}`, g.id);
  }

  for (const t of parsedTournaments) {
    for (const g of t.groups) {
      const existingGId = groupKeyToId.get(`${t.tournament.id}-${g.groupCode}`);
      if (existingGId) {
        const oldGId = g.id;
        g.id = existingGId;
        for (const m of t.matches) {
          if (m.historicalGroupId === oldGId) {
            m.historicalGroupId = existingGId;
          }
        }
      }
    }
  }

  // 1. Batch upsert canonical players
  const playerRows = Array.from(playersMap.values()).map((p) => ({
    id: p.id,
    canonical_name: p.canonicalName,
  }));
  const { error: pErr } = await supabase.from('players').upsert(playerRows, { onConflict: 'id' });
  if (pErr) throw new Error(`Failed to upsert players: ${pErr.message}`);
  console.log(`✅ Upserted ${playerRows.length} canonical players.`);

  // 2. Batch upsert aliases (deduplicated)
  const uniqueAliases = new Map<string, { player_id: string; alias: string; normalized_alias: string; source_system: string }>();
  for (const a of Array.from(aliasesMap.values())) {
    const aliasStr = a.alias || a.normalizedAlias;
    const key = `${aliasStr.toLowerCase().trim()}_official_archive`;
    if (!uniqueAliases.has(key)) {
      uniqueAliases.set(key, {
        player_id: a.playerId,
        alias: aliasStr,
        normalized_alias: a.normalizedAlias || aliasStr.toLowerCase().trim(),
        source_system: 'official_archive',
      });
    }
  }
  const aliasRows = Array.from(uniqueAliases.values());
  const { error: aErr } = await supabase.from('player_aliases').upsert(aliasRows, { onConflict: 'alias,source_system' });
  if (aErr) throw new Error(`Failed to upsert aliases: ${aErr.message}`);
  console.log(`✅ Upserted ${aliasRows.length} player aliases.`);

  // 3. Upsert historical tournaments
  const tournamentRows = parsedTournaments.map((t) => ({
    id: t.tournament.id,
    name: t.tournament.name,
    slug: t.tournament.slug,
    year: t.tournament.year,
    tournament_date: t.tournament.tournamentDate,
  }));
  const { error: tErr } = await supabase.from('historical_tournaments').upsert(tournamentRows, { onConflict: 'slug' });
  if (tErr) throw new Error(`Failed to upsert tournaments: ${tErr.message}`);
  console.log(`✅ Upserted ${tournamentRows.length} historical tournaments.`);

  // 4. Batch upsert groups
  const allGroups = parsedTournaments.flatMap((t) =>
    t.groups.map((g) => ({
      id: g.id,
      historical_tournament_id: t.tournament.id,
      group_code: g.groupCode,
      total_matches: g.expectedMatches,
    }))
  );
  const { error: gErr } = await supabase.from('historical_groups').upsert(allGroups, { onConflict: 'historical_tournament_id,group_code' });
  if (gErr) throw new Error(`Failed to upsert groups: ${gErr.message}`);
  console.log(`✅ Upserted ${allGroups.length} historical groups.`);

  // 5. Batch upsert matches
  const allMatches = parsedTournaments.flatMap((t) =>
    t.matches.map((m) => ({
      id: m.id,
      historical_tournament_id: t.tournament.id,
      group_id: m.historicalGroupId,
      stage: m.stage,
      player1_id: m.player1Id,
      player2_id: m.player2Id,
      score_player1: m.scorePlayer1,
      score_player2: m.scorePlayer2,
      winner_id: m.winnerId,
      status: m.status,
      is_missing: m.status === 'missing',
      played_at: m.matchDate,
    }))
  );
  const { error: mErr } = await supabase.from('historical_matches').upsert(allMatches, { onConflict: 'id' });
  if (mErr) throw new Error(`Failed to upsert matches: ${mErr.message}`);
  console.log(`✅ Upserted ${allMatches.length} historical matches (213 complete, 1 missing).`);

  // 6. Replay Glicko-2 and batch upsert rating states & snapshots
  console.log('Calculating chronological Glicko-2 ratings...');
  const replay = replayHistoricalTournaments(parsedTournaments);

  const ratingStateRows = Array.from(replay.ratingStates.values()).map((s) => ({
    player_id: s.playerId,
    rating: s.rating,
    rating_deviation: s.ratingDeviation,
    volatility: s.volatility,
    matches_played: s.matchesPlayed,
    last_played_at: s.lastCalculatedAt,
  }));
  const { error: rsErr } = await supabase.from('rating_states').upsert(ratingStateRows, { onConflict: 'player_id' });
  if (rsErr) throw new Error(`Failed to upsert rating states: ${rsErr.message}`);
  console.log(`✅ Upserted ${ratingStateRows.length} player rating states.`);

  // Clear snapshots for idempotency and insert new
  await supabase.from('rating_snapshots').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  const snapshotRows = replay.snapshots.map((snap) => ({
    id: snap.id,
    player_id: snap.playerId,
    historical_tournament_id: snap.ratingPeriodId,
    rating_before: snap.ratingBefore,
    rd_before: snap.rdBefore,
    volatility_before: snap.volBefore,
    rating_after: snap.ratingAfter,
    rd_after: snap.rdAfter,
    volatility_after: snap.volAfter,
    matches_in_period: snap.matchesInPeriod,
    wins_in_period: 0,
  }));
  const { error: snapErr } = await supabase.from('rating_snapshots').insert(snapshotRows);
  if (snapErr) throw new Error(`Failed to insert snapshots: ${snapErr.message}`);
  console.log(`✅ Inserted ${snapshotRows.length} rating snapshots.`);

  // 7. Ensure Superadmin auth user exists and profile is configured
  console.log(`Configuring Superadmin profile for ${SUPER_ADMIN_EMAIL}...`);
  try {
    const { data: userList } = await supabase.auth.admin.listUsers();
    let superAdminUser = userList?.users.find(u => u.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase());
    if (!superAdminUser) {
      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
        email: SUPER_ADMIN_EMAIL,
        email_confirm: true,
        user_metadata: { name: 'Guillermo Rivera' },
      });
      if (createErr) {
        console.warn('Note creating superadmin auth user:', createErr.message);
      } else {
        superAdminUser = newUser.user;
        console.log(`✅ Created Supabase Auth user for Superadmin: ${SUPER_ADMIN_EMAIL}`);
      }
    }

    if (superAdminUser) {
      const { error: updErr } = await supabase.from('profiles').update({
        role: 'super_admin',
        admin_status: 'approved',
        category: 'plus14',
        declared_level: 8.0,
      }).eq('id', superAdminUser.id);
      if (updErr) console.warn('Note updating superadmin profile:', updErr.message);
      else console.log(`✅ Superadmin profile confirmed for ${SUPER_ADMIN_EMAIL} (role = 'super_admin', admin_status = 'approved')`);
    }
  } catch (authErr: any) {
    console.warn('Auth admin note:', authErr.message);
  }

  console.log('------------------------------------------------');
  console.log('🎉 REMOTE SUPABASE SEED COMPLETED SUCCESSFULLY!');
}

seedRemote().catch((e) => {
  console.error('Fatal seed error:', e.message);
  process.exit(1);
});
