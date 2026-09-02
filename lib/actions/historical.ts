'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { importHistoricalSchema } from '@/lib/validation/schemas';
import {
  parseHistoricalRecords,
  replayHistoricalTournaments,
  type CanonicalPlayer,
  type PlayerAlias,
  type RawHistoricalMatchRecord,
  type RatingState,
} from '@/lib/engine/historical';
import {
  HISTORICAL_2024_MATCHES,
  HISTORICAL_2025_MATCHES,
  HISTORICAL_2026_MATCHES,
} from '@/lib/data';
import type { ActionResponse } from './tournament';

/**
 * Admin: Import a batch of historical matches (2024, 2025, 2026),
 * resolve canonical players and aliases, insert into historical archive,
 * and calculate immutable Glicko-2 rating snapshots.
 */
export async function importHistoricalDataAction(input: {
  sourceName: string;
  records: RawHistoricalMatchRecord[];
}): Promise<ActionResponse<{ importedTournaments: number; importedMatches: number }>> {
  try {
    const parsed = importHistoricalSchema.parse(input);
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { success: false, error: 'Unauthorized' };

    // Check admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin' && profile?.role !== 'super_admin') {
      return { success: false, error: 'Permisos insuficientes' };
    }

    // 1. Fetch existing canonical players and aliases from database
    const { data: dbPlayers } = await supabase.from('players').select('*');
    const { data: dbAliases } = await supabase.from('player_aliases').select('*');

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

    // 2. Parse raw records into historical tournament structures
    const parsedTournaments = parseHistoricalRecords(
      parsed.records as RawHistoricalMatchRecord[],
      playersMap,
      aliasesMap
    );

    // 3. Persist new canonical players and aliases
    for (const p of playersMap.values()) {
      await supabase.from('players').upsert({
        id: p.id,
        canonical_name: p.canonicalName,
        user_id: p.userId,
      }, { onConflict: 'id' });
    }

    for (const [normAlias, aliasObj] of aliasesMap.entries()) {
      await supabase.from('player_aliases').upsert({
        player_id: aliasObj.playerId,
        alias: normAlias,
        source_system: parsed.sourceName,
      }, { onConflict: 'alias,source_system' });
    }

    // 4. Create historical import record
    const { data: importRec } = await supabase
      .from('historical_imports')
      .insert({
        source_name: parsed.sourceName,
        imported_by: user.id,
        status: 'processed',
        records_count: parsed.records.length,
        raw_payload: { recordsCount: parsed.records.length },
      })
      .select()
      .single();

    // 5. Persist historical tournaments, groups, and matches
    let totalMatches = 0;
    for (const tData of parsedTournaments) {
      const { data: hTourney } = await supabase
        .from('historical_tournaments')
        .upsert({
          id: tData.tournament.id,
          import_id: importRec?.id ?? null,
          name: tData.tournament.name,
          slug: tData.tournament.slug,
          year: tData.tournament.year,
          tournament_date: tData.tournament.tournamentDate,
        }, { onConflict: 'slug' })
        .select()
        .single();

      const tourneyDbId = hTourney?.id ?? tData.tournament.id;

      for (const grp of tData.groups) {
        await supabase
          .from('historical_groups')
          .upsert({
            id: grp.id,
            historical_tournament_id: tourneyDbId,
            group_code: grp.groupCode,
            expected_matches: grp.expectedMatches,
          }, { onConflict: 'historical_tournament_id,group_code' });
      }

      for (const m of tData.matches) {
        await supabase.from('historical_matches').upsert({
          id: m.id,
          historical_tournament_id: tourneyDbId,
          historical_group_id: m.historicalGroupId,
          stage: m.stage,
          player1_id: m.player1Id,
          player2_id: m.player2Id,
          score_player1: m.scorePlayer1,
          score_player2: m.scorePlayer2,
          winner_id: m.winnerId,
          match_date: m.matchDate,
          source_record: m.sourceRecord as any,
        }, { onConflict: 'id' });
        totalMatches++;
      }
    }

    // 6. Replay all historical tournaments and update rating states & snapshots
    const { data: dbRatingStates } = await supabase.from('rating_states').select('*');
    const ratingStatesMap = new Map<string, RatingState>();
    for (const s of dbRatingStates ?? []) {
      ratingStatesMap.set(s.player_id, {
        playerId: s.player_id,
        rating: s.rating,
        ratingDeviation: s.rating_deviation,
        volatility: s.volatility,
        matchesPlayed: s.matches_played,
        lastCalculatedAt: s.last_calculated_at,
        updatedAt: s.updated_at,
      });
    }

    const replayResult = replayHistoricalTournaments(parsedTournaments, ratingStatesMap);

    // Save updated rating states & snapshots
    for (const state of replayResult.ratingStates.values()) {
      await supabase.from('rating_states').upsert({
        player_id: state.playerId,
        rating: state.rating,
        rating_deviation: state.ratingDeviation,
        volatility: state.volatility,
        matchesPlayed: state.matchesPlayed,
        lastCalculatedAt: state.lastCalculatedAt,
      }, { onConflict: 'player_id' });
    }

    for (const snap of replayResult.snapshots) {
      await supabase.from('rating_snapshots').insert({
        id: snap.id,
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
      });
    }

    // 7. Audit log
    await supabase.from('audit_logs').insert({
      actor_id: user.id,
      action: 'import_historical_data',
      entity_type: 'historical_imports',
      entity_id: importRec?.id ?? 'batch',
      previous_data: null,
      new_data: {
        source_name: parsed.sourceName,
        tournaments_count: parsedTournaments.length,
        matches_count: totalMatches,
      },
    });

    revalidatePath('/admin');
    return {
      success: true,
      data: {
        importedTournaments: parsedTournaments.length,
        importedMatches: totalMatches,
      },
    };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Admin: Seed the real historical dataset (2024: 63 matches, 2025: 91 matches, 2026: 59+1 missing)
 */
export async function seedRealHistoricalDataAction(): Promise<ActionResponse<{ totalMatches: number; status: string }>> {
  try {
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

    const res = await importHistoricalDataAction({
      sourceName: 'Official Real Historical Archive (2024-2026)',
      records: rawMatches,
    });

    if (!res.success) return { success: false, error: res.error };

    return {
      success: true,
      data: {
        totalMatches: rawMatches.length,
        status: '2024 (63 complete), 2025 (91 complete), 2026 (59 complete, 1 missing in Group A)',
      },
    };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Admin: Confirm or separate player alias identity resolution
 */
export async function resolveIdentityAction(input: {
  aliasId: string;
  targetPlayerId: string;
  action: 'confirm_merge' | 'keep_separate';
}): Promise<ActionResponse<{ resolved: boolean }>> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin' && profile?.role !== 'super_admin') {
      return { success: false, error: 'Permisos insuficientes' };
    }

    if (input.action === 'confirm_merge') {
      await supabase
        .from('player_aliases')
        .update({ player_id: input.targetPlayerId })
        .eq('id', input.aliasId);
    }

    revalidatePath('/admin/historical');
    return { success: true, data: { resolved: true } };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}
