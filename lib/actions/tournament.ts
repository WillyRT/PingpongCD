'use server';

import { createClient, createAdminClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { createTournamentSchema, qualifiersConfigSchema } from '@/lib/validation/schemas';
import { calculateGroupCount, calculateGroupSizes } from '@/lib/engine/groups';
import { assignSeeds, snakeDistributeWithCBI } from '@/lib/engine/seeding';
import { generateRoundRobin } from '@/lib/engine/schedule';
import { generateBracket, validateBracketConfig, type QualifiedPlayer } from '@/lib/engine/bracket';
import { calculateStandings, type ConfirmedMatch } from '@/lib/engine/standings';
import { canTransition, validateTransitionRequirements, type TransitionContext } from '@/lib/engine/tournament-state';
import { calculateWinProbability } from '@/lib/engine/analytics';
import { updateRating, type PlayerRating, type RatingMatchResult } from '@/lib/engine/rating';
import { identifySub14Finalists } from '@/lib/engine/tournament-rules';
import type { AgeCategory } from '@/lib/types/domain';

export interface ActionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Admin: Create a new tournament.
 */
export async function createTournamentAction(formData: {
  name: string;
  hiddenStandings: boolean;
}): Promise<ActionResponse<{ id: string; slug: string }>> {
  try {
    const parsed = createTournamentSchema.parse(formData);
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { success: false, error: 'Unauthorized' };

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin' && profile?.role !== 'super_admin') {
      return { success: false, error: 'Only admins can create tournaments' };
    }

    const cleanName = parsed.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const slug = `${cleanName || 'torneo'}-${Date.now().toString(36)}`;

    const { data: tournament, error: tourneyError } = await supabase
      .from('tournaments')
      .insert({
        name: parsed.name,
        slug,
        status: 'draft',
        hidden_standings: parsed.hiddenStandings,
        created_by: user.id,
      })
      .select()
      .single();

    if (tourneyError || !tournament) {
      return { success: false, error: tourneyError?.message || 'Failed to create tournament' };
    }

    await supabase.from('tournament_config').insert({
      tournament_id: tournament.id,
      hidden_standings: parsed.hiddenStandings,
      group_target_points: 7,
      knockout_target_points: 11,
      final_target_points: 15,
      required_difference: 2,
      qualifiers_per_group: null,
    });

    await supabase.from('audit_logs').insert({
      actor_id: user.id,
      action: 'create_tournament',
      entity_type: 'tournaments',
      entity_id: tournament.id,
      previous_data: null,
      new_data: { name: parsed.name, slug, status: 'draft' },
    });

    revalidatePath('/admin');
    return { success: true, data: { id: tournament.id, slug: tournament.slug } };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Admin: Open registration for a tournament.
 */
export async function openRegistrationAction(tournamentId: string): Promise<ActionResponse> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    const { data: tourney } = await supabase
      .from('tournaments')
      .select('status')
      .eq('id', tournamentId)
      .single();

    if (!tourney) return { success: false, error: 'Tournament not found' };

    if (!canTransition(tourney.status as any, 'registration')) {
      return { success: false, error: `Cannot open registration from status '${tourney.status}'` };
    }

    await supabase
      .from('tournaments')
      .update({ status: 'registration' })
      .eq('id', tournamentId);

    await supabase.from('audit_logs').insert({
      actor_id: user.id,
      action: 'open_registration',
      entity_type: 'tournaments',
      entity_id: tournamentId,
      previous_data: { status: tourney.status },
      new_data: { status: 'registration' },
    });

    revalidatePath(`/admin/tournaments/${tournamentId}`);
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Player: Join an open tournament (defaults to plus14 if unspecified).
 */
export async function joinTournamentAction(
  tournamentSlug: string,
  category: AgeCategory = 'plus14'
): Promise<ActionResponse> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Must be logged in to join' };

    const { data: tourney } = await supabase
      .from('tournaments')
      .select('id, status, slug')
      .eq('slug', tournamentSlug)
      .single();

    if (!tourney) return { success: false, error: 'Tournament not found' };
    const tournamentId = tourney.id;

    if (tourney.status !== 'registration') {
      return { success: false, error: 'Registration is not open for this tournament' };
    }

    const { error } = await supabase
      .from('tournament_participants')
      .insert({
        tournament_id: tournamentId,
        user_id: user.id,
        category,
        seed_number: null,
      });

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'You have already joined this tournament' };
      }
      return { success: false, error: error.message };
    }

    await supabase.from('audit_logs').insert({
      actor_id: user.id,
      action: 'join_tournament',
      entity_type: 'tournament_participants',
      entity_id: `${tournamentId}_${user.id}`,
      previous_data: null,
      new_data: { tournament_id: tournamentId, user_id: user.id, category },
    });

    revalidatePath(`/t/${tourney.slug}`);
    revalidatePath('/player');
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Admin: Generate groups, snake seed participants, compute CBI, and schedule group matches.
 * Supports category separation: generates groups for each category independently.
 */
export async function generateGroupsAndScheduleAction(
  tournamentId: string,
  targetCategory?: AgeCategory
): Promise<ActionResponse> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    // Fetch participants with their ratings
    let query = supabase
      .from('tournament_participants')
      .select('*, profiles:user_id (id, rating, rating_deviation, matches_played)')
      .eq('tournament_id', tournamentId);

    if (targetCategory) {
      query = query.eq('category', targetCategory);
    }

    const { data: participants, error: pError } = await query;

    if (pError || !participants || participants.length < 4) {
      return { success: false, error: 'Need at least 4 registered players to generate groups' };
    }

    // Determine categories present
    const categories: AgeCategory[] = targetCategory
      ? [targetCategory]
      : Array.from(new Set(participants.map((p) => (p.category ?? 'plus14') as AgeCategory)));

    for (const cat of categories) {
      const catParticipants = participants.filter((p) => (p.category ?? 'plus14') === cat);
      if (catParticipants.length < 4) continue;

      const totalPlayers = catParticipants.length;
      const groupCount = calculateGroupCount(totalPlayers);

      const seedablePlayers = catParticipants.map((p) => {
        const prof = p.profiles as any;
        return {
          id: p.user_id,
          rating: prof?.rating ?? 1500,
          rating_deviation: prof?.rating_deviation ?? 350,
          matches_played: prof?.matches_played ?? 0,
          category: cat,
        };
      });

      const seededPlayers = assignSeeds(seedablePlayers);
      const { assignments } = snakeDistributeWithCBI(seededPlayers, groupCount);

      // Create or update tournament groups for this category
      const groupCodes = ['A', 'B', 'C', 'D'].slice(0, groupCount);
      const createdGroups: Array<{ id: string; code: string; index: number }> = [];

      for (let i = 0; i < groupCount; i++) {
        const code = groupCodes[i]!;
        const playersInGroup = assignments.filter((a) => a.groupIndex === i);
        const expectedMatches = (playersInGroup.length * (playersInGroup.length - 1)) / 2;

        const { data: grp, error: gError } = await supabase
          .from('tournament_groups')
          .upsert({
            tournament_id: tournamentId,
            category: cat,
            group_code: code,
            status: 'active',
            expected_matches: expectedMatches,
          }, { onConflict: 'tournament_id,category,group_code' })
          .select()
          .single();

        if (gError || !grp) return { success: false, error: 'Failed to create groups' };
        createdGroups.push({ id: grp.id, code, index: i });
      }

      // Update participant group & seed assignments
      for (const assignment of assignments) {
        const grp = createdGroups.find((g) => g.index === assignment.groupIndex);
        if (!grp) continue;

        await supabase
          .from('tournament_participants')
          .update({
            group_id: grp.id,
            seed_number: assignment.seed,
          })
          .eq('tournament_id', tournamentId)
          .eq('user_id', assignment.player.id);
      }

      // Generate round robin matches for each group
      await supabase
        .from('matches')
        .delete()
        .eq('tournament_id', tournamentId)
        .eq('stage', 'group')
        .eq('category', cat);

      const ratingMap = new Map<string, number>();
      for (const p of catParticipants) {
        ratingMap.set(p.user_id, (p.profiles as any)?.rating ?? 1500);
      }

      for (const grp of createdGroups) {
        const groupPlayers = assignments
          .filter((a) => a.groupIndex === grp.index)
          .map((a) => a.player.id);

        const pairings = generateRoundRobin(groupPlayers);

        for (const pair of pairings) {
          const r1 = ratingMap.get(pair.player1Id) ?? 1500;
          const r2 = ratingMap.get(pair.player2Id) ?? 1500;
          const { p1, p2 } = calculateWinProbability(r1, r2);

          await supabase.from('matches').insert({
            tournament_id: tournamentId,
            category: cat,
            stage: 'group',
            group_id: grp.id,
            player1_id: pair.player1Id,
            player2_id: pair.player2Id,
            status: 'pending',
            win_expectancy_p1: p1,
            win_expectancy_p2: p2,
          });
        }
      }
    }

    await supabase
      .from('tournaments')
      .update({ status: 'group_stage' })
      .eq('id', tournamentId);

    revalidatePath(`/admin/tournaments/${tournamentId}`);
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Admin: Reassign a participant to a different group (manual adjustment / drag & drop before matches start).
 */
export async function reassignParticipantGroupAction(
  tournamentId: string,
  userId: string,
  targetGroupId: string
): Promise<ActionResponse> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    const { error } = await supabase
      .from('tournament_participants')
      .update({ group_id: targetGroupId })
      .eq('tournament_id', tournamentId)
      .eq('user_id', userId);

    if (error) return { success: false, error: error.message };

    revalidatePath(`/admin/tournaments/${tournamentId}`);
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Admin: Configure qualifiers per group and generate the dynamic bracket.
 */
export async function configureQualifiersAndGenerateBracketAction(
  tournamentId: string,
  qualifiersPerGroup: number,
  category: AgeCategory = 'plus14'
): Promise<ActionResponse> {
  try {
    const parsed = qualifiersConfigSchema.parse({ qualifiersPerGroup });
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    let groupQuery = supabase
      .from('tournament_groups')
      .select('*')
      .eq('tournament_id', tournamentId);

    if (category) {
      groupQuery = groupQuery.eq('category', category);
    }

    const { data: groups, error: gError } = await groupQuery.order('group_code', { ascending: true });

    if (gError || !groups || groups.length === 0) {
      return { success: false, error: 'No groups found for this category' };
    }

    // Fetch matches for this category
    const { data: matches, error: mError } = await supabase
      .from('matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('stage', 'group')
      .eq('category', category)
      .eq('status', 'confirmed');

    if (mError) return { success: false, error: 'Failed to fetch confirmed matches' };

    // Fetch seeds
    const { data: participants } = await supabase
      .from('tournament_participants')
      .select('user_id, group_id, seed_number, profiles:user_id (rating)')
      .eq('tournament_id', tournamentId)
      .eq('category', category);

    const seedsMap = new Map<string, number>();
    const ratingsMap = new Map<string, number>();
    for (const p of participants ?? []) {
      seedsMap.set(p.user_id, p.seed_number ?? 99);
      ratingsMap.set(p.user_id, (p.profiles as any)?.rating ?? 1500);
    }

    const qualifiers: QualifiedPlayer[] = [];

    for (let gIdx = 0; gIdx < groups.length; gIdx++) {
      const grp = groups[gIdx]!;
      const groupPlayerIds = (participants ?? [])
        .filter((p) => p.group_id === grp.id)
        .map((p) => p.user_id);

      const groupMatches: ConfirmedMatch[] = (matches ?? [])
        .filter((m) => m.group_id === grp.id)
        .map((m) => ({
          player1Id: m.player1_id,
          player2Id: m.player2_id,
          score1: m.score_player1 ?? 0,
          score2: m.score_player2 ?? 0,
          winnerId: m.winner_id ?? '',
        }));

      const standings = calculateStandings(groupPlayerIds, groupMatches, seedsMap, ratingsMap);
      const topN = standings.slice(0, qualifiersPerGroup);

      for (const standing of topN) {
        qualifiers.push({
          playerId: standing.playerId,
          groupIndex: gIdx,
          groupPosition: standing.position,
          seed: seedsMap.get(standing.playerId) ?? 99,
        });
      }
    }

    const bracket = generateBracket(qualifiers, groups.length, qualifiersPerGroup);

    // Save bracket matches
    await supabase
      .from('matches')
      .delete()
      .eq('tournament_id', tournamentId)
      .neq('stage', 'group')
      .eq('category', category);

    for (const bMatch of bracket.matches) {
      if (bMatch.player1Id && bMatch.player2Id) {
        const r1 = ratingsMap.get(bMatch.player1Id) ?? 1500;
        const r2 = ratingsMap.get(bMatch.player2Id) ?? 1500;
        const { p1, p2 } = calculateWinProbability(r1, r2);

        await supabase.from('matches').insert({
          tournament_id: tournamentId,
          category,
          stage: bMatch.stage as any,
          bracket_match_id: bMatch.id,
          player1_id: bMatch.player1Id,
          player2_id: bMatch.player2Id,
          status: 'pending',
          win_expectancy_p1: p1,
          win_expectancy_p2: p2,
        });
      }
    }

    await supabase
      .from('tournament_config')
      .update({ qualifiers_per_group: qualifiersPerGroup })
      .eq('tournament_id', tournamentId);

    await supabase
      .from('tournaments')
      .update({ status: 'bracket_stage' })
      .eq('id', tournamentId);

    revalidatePath(`/admin/tournaments/${tournamentId}`);
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Admin: Finish a tournament, consolidate Glicko-2 ratings in rating_states,
 * and record final snapshots in rating_snapshots.
 */
export async function finishTournamentAction(tournamentId: string): Promise<ActionResponse> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, admin_status')
      .eq('id', user.id)
      .maybeSingle();

    const isAdmin =
      profile?.role === 'super_admin' ||
      (profile?.role === 'admin' && profile?.admin_status === 'approved');

    if (!isAdmin) {
      return { success: false, error: 'Solo administradores aprobados pueden finalizar torneos.' };
    }

    const { data: tourney } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', tournamentId)
      .single();

    if (!tourney) return { success: false, error: 'Tournament not found' };

    // Idempotent early exit if tournament is already finished
    if (tourney.status === 'finished') {
      return {
        success: true,
        data: { alreadyFinished: true, message: 'El torneo ya está finalizado. No se duplicaron snapshots ni ratings.' },
      };
    }

    // Atomic status transition lock: only one execution can acquire the transition from non-finished
    const { data: lockedTourney } = await supabase
      .from('tournaments')
      .update({ status: 'finished' })
      .eq('id', tournamentId)
      .neq('status', 'finished')
      .select('id')
      .maybeSingle();

    if (!lockedTourney) {
      return {
        success: true,
        data: { alreadyFinished: true, message: 'El torneo ya está finalizado. No se duplicaron snapshots ni ratings.' },
      };
    }

    const { data: matches } = await supabase
      .from('matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('status', 'confirmed');

    const { data: participants } = await supabase
      .from('tournament_participants')
      .select('user_id, profiles:user_id (id, rating, rating_deviation, volatility, matches_played)')
      .eq('tournament_id', tournamentId);

    if (!participants || participants.length === 0) {
      return { success: false, error: 'No participants found' };
    }

    const playerRatingsMap = new Map<string, PlayerRating>();
    for (const p of participants) {
      const prof = p.profiles as any;
      playerRatingsMap.set(p.user_id, {
        rating: prof?.rating ?? 1500,
        ratingDeviation: prof?.rating_deviation ?? 350,
        volatility: prof?.volatility ?? 0.06,
        matchesPlayed: prof?.matches_played ?? 0,
      });
    }

    const now = new Date().toISOString();

    for (const p of participants) {
      const current = playerRatingsMap.get(p.user_id)!;
      const playerMatches = (matches ?? []).filter(
        (m) => m.player1_id === p.user_id || m.player2_id === p.user_id
      );

      const results: RatingMatchResult[] = playerMatches.map((m) => {
        const isP1 = m.player1_id === p.user_id;
        const opponentId = isP1 ? m.player2_id : m.player1_id;
        const opponentRating = playerRatingsMap.get(opponentId) ?? {
          rating: 1500,
          ratingDeviation: 350,
          volatility: 0.06,
          matchesPlayed: 0,
        };
        const score = (isP1 ? m.score_player1! > m.score_player2! : m.score_player2! > m.score_player1!) ? 1 : 0;
        return { opponent: opponentRating, score: score as 1 | 0 };
      });

      const updated = updateRating(current, results);

      // Update profile
      await supabase
        .from('profiles')
        .update({
          rating: updated.rating,
          rating_deviation: updated.ratingDeviation,
          volatility: updated.volatility,
          matches_played: updated.matchesPlayed,
        })
        .eq('id', p.user_id);

      // Upsert into rating_states
      await supabase
        .from('rating_states')
        .upsert({
          player_id: p.user_id,
          rating: updated.rating,
          rating_deviation: updated.ratingDeviation,
          volatility: updated.volatility,
          matches_played: updated.matchesPlayed,
          last_calculated_at: now,
        }, { onConflict: 'player_id' });

      // Insert snapshot
      await supabase
        .from('rating_snapshots')
        .insert({
          id: crypto.randomUUID(),
          player_id: p.user_id,
          rating_period_id: tournamentId,
          period_type: 'live_tournament',
          rating_before: current.rating,
          rd_before: current.ratingDeviation,
          vol_before: current.volatility,
          rating_after: updated.rating,
          rd_after: updated.ratingDeviation,
          vol_after: updated.volatility,
          matches_in_period: results.length,
        });
    }

    await supabase
      .from('tournaments')
      .update({ status: 'finished' })
      .eq('id', tournamentId);

    await supabase.from('audit_logs').insert({
      actor_id: user.id,
      action: 'finish_tournament',
      entity_type: 'tournaments',
      entity_id: tournamentId,
      new_data: { status: 'finished', participantsCount: participants.length },
    });

    revalidatePath(`/admin/tournaments/${tournamentId}`);
    revalidatePath('/leaderboard');
    revalidatePath('/player');
    revalidatePath('/me');
    revalidatePath('/');

    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Promotes Sub-14 Champion and Runner-up into the Senior tournament draw.
 * Preserves updated Glicko-2 ratings and registers them with category 'sub14_promoted'.
 */
export async function promoteSub14FinalistsAction(input: {
  sub14TournamentId: string;
  seniorTournamentId: string;
}): Promise<ActionResponse<{ promoted: Array<{ playerId: string; name: string; position: 1 | 2 }> }>> {
  try {
    const admin = createAdminClient();

    // 1. Fetch Sub-14 matches to identify champion and runner-up
    const { data: sub14Matches, error: mErr } = await admin
      .from('matches')
      .select('*')
      .eq('tournament_id', input.sub14TournamentId);

    if (mErr || !sub14Matches || sub14Matches.length === 0) {
      return { success: false, error: 'No se encontraron partidos para el torneo Sub-14' };
    }

    const { championId, runnerUpId, isComplete } = identifySub14Finalists(sub14Matches);

    if (!isComplete || !championId || !runnerUpId) {
      return {
        success: false,
        error: 'La final Sub-14 aún no ha concluido con un ganador oficial verificado.',
      };
    }

    // 2. Fetch player profiles
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, name, nickname, rating')
      .in('id', [championId, runnerUpId]);

    const championProfile = profiles?.find((p) => p.id === championId);
    const runnerUpProfile = profiles?.find((p) => p.id === runnerUpId);

    // 3. Verify Senior tournament exists
    const { data: seniorTournament, error: sErr } = await admin
      .from('tournaments')
      .select('*')
      .eq('id', input.seniorTournamentId)
      .single();

    if (sErr || !seniorTournament) {
      return { success: false, error: 'Torneo Senior de destino no encontrado' };
    }

    // 4. Enroll both finalists into Senior tournament participants
    const finalists = [
      {
        playerId: championId,
        name: championProfile?.nickname || championProfile?.name || 'Campeón Sub-14',
        position: 1 as const,
      },
      {
        playerId: runnerUpId,
        name: runnerUpProfile?.nickname || runnerUpProfile?.name || 'Subcampeón Sub-14',
        position: 2 as const,
      },
    ];

    for (const f of finalists) {
      await admin.from('tournament_participants').upsert(
        {
          tournament_id: input.seniorTournamentId,
          user_id: f.playerId,
          category: 'sub14_promoted' as any,
          confirmed_at: new Date().toISOString(),
        },
        { onConflict: 'tournament_id, user_id' }
      );
    }

    revalidatePath(`/admin/tournaments/${input.seniorTournamentId}`);
    revalidatePath(`/t/${seniorTournament.slug}`);

    return {
      success: true,
      data: { promoted: finalists },
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Error al promover finalistas Sub-14',
    };
  }
}
