'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { determineAgeCategory } from '@/lib/engine/categories';
import { calculateProvisionalRating, FALLBACK_MIN_ELO, FALLBACK_MAX_ELO } from '@/lib/engine/rating';
import type { ActionResponse } from './tournament';

export interface PlayerLookupResult {
  found: boolean;
  name?: string;
  rating?: number;
  ratingDeviation?: number;
  category?: 'sub14' | 'plus14';
}

/**
 * Public: Lookup player profile and historical rating by email.
 * Used by the /join/[tournamentId] form for autocompletion.
 */
export async function lookupPlayerByEmailAction(email: string): Promise<ActionResponse<PlayerLookupResult>> {
  try {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) {
      return { success: true, data: { found: false } };
    }

    const supabase = await createClient();

    // 1. Check profiles
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, name, rating, rating_deviation, category')
      .ilike('email', trimmed)
      .maybeSingle();

    if (profile) {
      return {
        success: true,
        data: {
          found: true,
          name: profile.name,
          rating: Math.round(profile.rating),
          ratingDeviation: Math.round(profile.rating_deviation),
          category: profile.category as any,
        },
      };
    }

    // 2. Check canonical players
    const { data: canonical } = await supabase
      .from('players')
      .select('id, canonical_name')
      .ilike('canonical_name', trimmed.split('@')[0] || '')
      .maybeSingle();

    if (canonical) {
      const { data: ratingState } = await supabase
        .from('rating_states')
        .select('rating, rating_deviation')
        .eq('player_id', canonical.id)
        .maybeSingle();

      return {
        success: true,
        data: {
          found: true,
          name: canonical.canonical_name,
          rating: ratingState ? Math.round(ratingState.rating) : 1500,
          ratingDeviation: ratingState ? Math.round(ratingState.rating_deviation) : 350,
        },
      };
    }

    return { success: true, data: { found: false } };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Error buscando jugador' };
  }
}

/**
 * Public: Join a tournament with profile details (email, nickname, age/birthdate, declaredLevel).
 */
export async function publicJoinTournamentAction(formData: {
  tournamentIdOrSlug: string;
  email: string;
  name: string;
  birthDateOrAge: string | number;
  declaredLevel: number;
}): Promise<ActionResponse<{ participantId: string; category: string; rating: number }>> {
  try {
    const supabase = await createClient();

    // 1. Resolve tournament safely (dual lookup: UUID or slug)
    const rawParam = decodeURIComponent(formData.tournamentIdOrSlug).trim();
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    let tournament = null;

    if (UUID_REGEX.test(rawParam)) {
      const { data } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', rawParam)
        .maybeSingle();
      tournament = data;
    }

    if (!tournament) {
      const { data: bySlug } = await supabase
        .from('tournaments')
        .select('*')
        .eq('slug', rawParam)
        .maybeSingle();
      tournament = bySlug;

      if (!tournament) {
        const normalizedSlug = rawParam
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');

        const { data: byNorm } = await supabase
          .from('tournaments')
          .select('*')
          .eq('slug', normalizedSlug)
          .maybeSingle();
        tournament = byNorm;
      }

      if (!tournament) {
        const { data: byIlike } = await supabase
          .from('tournaments')
          .select('*')
          .ilike('slug', rawParam)
          .maybeSingle();
        tournament = byIlike;
      }
    }

    if (!tournament) {
      return { success: false, error: 'Torneo no encontrado' };
    }

    const st = (tournament.status || '').toLowerCase();
    if (st === 'finished' || st === 'completed') {
      return { success: false, error: 'Las inscripciones para este torneo están cerradas porque el torneo ha finalizado' };
    }

    const category = determineAgeCategory(formData.birthDateOrAge);
    const clampedLevel = Math.max(0, Math.min(10, Number(formData.declaredLevel) || 5));

    // Dynamic rating query for MIN and MAX
    const { data: minState } = await supabase
      .from('rating_states')
      .select('rating')
      .order('rating', { ascending: true })
      .limit(1)
      .maybeSingle();

    const { data: maxState } = await supabase
      .from('rating_states')
      .select('rating')
      .order('rating', { ascending: false })
      .limit(1)
      .maybeSingle();

    const minElo = minState?.rating ?? FALLBACK_MIN_ELO;
    const maxElo = maxState?.rating ?? FALLBACK_MAX_ELO;

    // Check if user is currently authenticated
    const { data: { user } } = await supabase.auth.getUser();

    let targetUserId = user?.id;

    // If not authenticated, find existing profile or create a mock/placeholder profile
    if (!targetUserId) {
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id, rating')
        .ilike('email', formData.email.trim().toLowerCase())
        .maybeSingle();

      if (existingProfile) {
        targetUserId = existingProfile.id;
      }
    }

    // Determine initial rating
    const prov = calculateProvisionalRating(clampedLevel, minElo, maxElo);
    const assignedRating = prov.rating;

    // If still no targetUserId, we generate a participant profile UUID
    if (!targetUserId) {
      const newUserId = crypto.randomUUID();
      const { error: profErr } = await supabase.from('profiles').insert({
        id: newUserId,
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        role: 'player',
        declared_level: clampedLevel,
        category,
        rating: assignedRating,
        rating_deviation: 350,
        volatility: 0.06,
      });

      if (profErr && profErr.code !== '23505') {
        return { success: false, error: `Error creando perfil: ${profErr.message}` };
      }
      targetUserId = newUserId;
    } else {
      // Update profile with category & declared level if missing
      await supabase
        .from('profiles')
        .update({
          category,
          declared_level: clampedLevel,
        })
        .eq('id', targetUserId);
    }

    // 2. Add to tournament_participants
    const { error: partErr } = await supabase
      .from('tournament_participants')
      .upsert({
        tournament_id: tournament.id,
        user_id: targetUserId,
        category,
        declared_level: clampedLevel,
      }, { onConflict: 'tournament_id,user_id' });

    if (partErr) {
      return { success: false, error: `Error en la inscripción: ${partErr.message}` };
    }

    await supabase.from('audit_logs').insert({
      actor_id: targetUserId,
      action: 'public_join_tournament',
      entity_type: 'tournament_participants',
      entity_id: `${tournament.id}_${targetUserId}`,
      new_data: { category, declared_level: clampedLevel, rating: assignedRating },
    });

    revalidatePath(`/join/${formData.tournamentIdOrSlug}`);
    revalidatePath(`/t/${tournament.slug}`);
    revalidatePath(`/admin/tournaments/${tournament.id}`);

    return {
      success: true,
      data: {
        participantId: targetUserId,
        category,
        rating: assignedRating,
      },
    };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Error inesperado' };
  }
}
