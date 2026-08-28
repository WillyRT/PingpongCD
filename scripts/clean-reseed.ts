import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const secretKey = process.env.SUPABASE_SECRET_KEY || '';

const supabase = createClient(supabaseUrl, secretKey, {
  auth: { persistSession: false },
});

function deterministicUUID(input: string): string {
  const hash = createHash('sha256').update(input).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

async function cleanAndReseed() {
  console.log('=== CLEANING & DETERMINISTIC RESEEDING ===');

  // 0. Clean old test data
  await supabase.from('rating_snapshots').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('rating_states').delete().neq('player_id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('historical_matches').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('historical_groups').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('historical_tournaments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('player_aliases').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('players').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('Cleared previous database records.');

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

  const playersMap = new Map<string, CanonicalPlayer>();
  const aliasesMap = new Map<string, PlayerAlias>();

  const parsedTournaments = parseHistoricalRecords(rawMatches, playersMap, aliasesMap);

  // Map players to deterministic UUIDs
  const oldToNewPlayerId = new Map<string, string>();
  for (const [oldId, player] of playersMap.entries()) {
    const detId = deterministicUUID(`player-${player.canonicalName.toLowerCase().trim()}`);
    oldToNewPlayerId.set(oldId, detId);
    player.id = detId;
  }

  for (const alias of aliasesMap.values()) {
    alias.id = deterministicUUID(`alias-${alias.normalizedAlias}`);
    alias.playerId = oldToNewPlayerId.get(alias.playerId) || alias.playerId;
  }

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

      m.player1Id = oldToNewPlayerId.get(m.player1Id) || m.player1Id;
      m.player2Id = oldToNewPlayerId.get(m.player2Id) || m.player2Id;
      if (m.winnerId) {
        m.winnerId = oldToNewPlayerId.get(m.winnerId) || m.winnerId;
      }

      m.id = deterministicUUID(
        `match-${t.tournament.slug}-${(m.sourceRecord as any)?.groupCode}-${(m.sourceRecord as any)?.player1Name}-${(m.sourceRecord as any)?.player2Name}`
      );
    }
  }

  // 1. Batch upsert canonical players
  const playerRows = Array.from(playersMap.values()).map((p) => ({
    id: p.id,
    canonical_name: p.canonicalName,
  }));
  const { error: pErr } = await supabase.from('players').upsert(playerRows, { onConflict: 'id' });
  if (pErr) throw new Error(`Players error: ${pErr.message}`);
  console.log(`✅ Inserted ${playerRows.length} canonical players.`);

  // 2. Batch upsert aliases
  const aliasRows = Array.from(aliasesMap.values()).map((a) => ({
    id: a.id,
    player_id: a.playerId,
    alias: a.normalizedAlias,
    source_system: 'official_archive',
  }));
  const { error: aErr } = await supabase.from('player_aliases').upsert(aliasRows, { onConflict: 'id' });
  if (aErr) throw new Error(`Aliases error: ${aErr.message}`);
  console.log(`✅ Inserted ${aliasRows.length} player aliases.`);

  // 3. Batch upsert historical tournaments
  const tournamentRows = parsedTournaments.map((t) => ({
    id: t.tournament.id,
    name: t.tournament.name,
    slug: t.tournament.slug,
    year: t.tournament.year,
    tournament_date: t.tournament.tournamentDate,
  }));
  const { error: tErr } = await supabase.from('historical_tournaments').upsert(tournamentRows, { onConflict: 'slug' });
  if (tErr) throw new Error(`Tournaments error: ${tErr.message}`);
  console.log(`✅ Inserted ${tournamentRows.length} historical tournaments.`);

  // 4. Batch upsert groups
  const groupRows = parsedTournaments.flatMap((t) =>
    t.groups.map((g) => ({
      id: g.id,
      historical_tournament_id: t.tournament.id,
      group_code: g.groupCode,
      expected_matches: g.expectedMatches,
    }))
  );
  const { error: gErr } = await supabase.from('historical_groups').upsert(groupRows, { onConflict: 'historical_tournament_id,group_code' });
  if (gErr) throw new Error(`Groups error: ${gErr.message}`);
  console.log(`✅ Inserted ${groupRows.length} historical groups.`);

  // 5. Batch upsert matches
  const matchRows = parsedTournaments.flatMap((t) =>
    t.matches.map((m) => ({
      id: m.id,
      historical_tournament_id: t.tournament.id,
      historical_group_id: m.historicalGroupId,
      stage: m.stage,
      player1_id: m.player1Id,
      player2_id: m.player2Id,
      score_player1: m.scorePlayer1,
      score_player2: m.scorePlayer2,
      winner_id: m.winnerId,
      status: m.status,
      match_date: m.matchDate,
      source_record: m.sourceRecord,
    }))
  );
  const { error: mErr } = await supabase.from('historical_matches').upsert(matchRows, { onConflict: 'id' });
  if (mErr) throw new Error(`Matches error: ${mErr.message}`);
  console.log(`✅ Inserted ${matchRows.length} historical matches (213 complete, 1 missing).`);

  // 6. Replay Glicko-2
  console.log('Running Glicko-2 ratings replay...');
  const replay = replayHistoricalTournaments(parsedTournaments);

  const ratingStateRows = Array.from(replay.ratingStates.values()).map((s) => ({
    player_id: s.playerId,
    rating: s.rating,
    rating_deviation: s.ratingDeviation,
    volatility: s.volatility,
    matches_played: s.matchesPlayed,
    last_calculated_at: s.lastCalculatedAt,
  }));
  const { error: rErr } = await supabase.from('rating_states').upsert(ratingStateRows, { onConflict: 'player_id' });
  if (rErr) throw new Error(`Rating states error: ${rErr.message}`);
  console.log(`✅ Inserted ${ratingStateRows.length} player rating states.`);

  const snapshotRows = replay.snapshots.map((snap) => ({
    id: deterministicUUID(`snap-${snap.playerId}-${snap.ratingPeriodId}`),
    player_id: snap.playerId,
    rating_period_id: snap.ratingPeriodId,
    period_type: snap.periodType,
    rating_before: snap.ratingBefore,
    rd_before: snap.rdBefore,
    vol_before: snap.volBefore,
    rating_after: snap.ratingAfter,
    rd_after: snap.rdAfter,
    vol_after: snap.volAfter,
    matches_in_period: snap.matchesInPeriod,
  }));
  const { error: sErr } = await supabase.from('rating_snapshots').insert(snapshotRows);
  if (sErr) throw new Error(`Rating snapshots error: ${sErr.message}`);
  console.log(`✅ Inserted ${snapshotRows.length} rating snapshots.`);

  console.log('----------------------------------------------------');
  console.log('🎯 DETERMINISTIC SEED & REPLAY FULLY COMPLETE!');
}

cleanAndReseed().catch((e) => {
  console.error('Fatal seed error:', e.message);
  process.exit(1);
});
