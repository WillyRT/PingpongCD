'use server';

import { createClient, createAdminClient } from '@/lib/supabase/server';
import { cookies, headers } from 'next/headers';
import { setPlayerSessionCookie } from '@/lib/auth/player-session';
import { checkSearchRateLimit } from '@/lib/auth/rate-limit';
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

export interface ExistingPlayerSuggestion {
  id: string;
  name: string; // canonical name or nickname
  nickname?: string;
  canonicalName?: string;
  matchedAlias?: string;
  emailMasked: string;
  emailReal?: string;
  birthDate?: string;
  category?: 'sub14' | 'plus14';
  rating: number;
  ratingDeviation?: number;
  matchesPlayed: number;
  declaredLevel?: number;
  source: 'profile' | 'historical';
}

export type HistoricalPlayerSuggestion = ExistingPlayerSuggestion;

/**
 * Partially obfuscates email for public search privacy (e.g. richy@hotmail.com -> r***y@hotmail.com).
 */
function obfuscateEmail(email?: string | null): string {
  if (!email || !email.includes('@')) return '';
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

/**
 * Public: Search existing players in active profiles and historical archive with latest Glicko-2 ratings.
 * Protected with IP rate limiting (max 15 req/min) and executes via service role (bypassing RLS for public join).
 */
export async function searchExistingPlayersAction(
  query: string
): Promise<ActionResponse<ExistingPlayerSuggestion[]>> {
  try {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) {
      return { success: true, data: [] };
    }

    // Rate-limiting check per client IP
    let clientIp = '127.0.0.1';
    try {
      const headersList = await headers();
      clientIp =
        headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        headersList.get('x-real-ip')?.trim() ||
        '127.0.0.1';
    } catch {
      // Ignored outside active HTTP request context (e.g. tests)
    }

    if (!checkSearchRateLimit(clientIp, 15, 60_000)) {
      return {
        success: false,
        error: 'Demasiadas consultas de búsqueda. Espera un minuto antes de volver a intentarlo.',
      };
    }

    const admin = createAdminClient();
    const map = new Map<string, ExistingPlayerSuggestion>();

    // 1. Search existing profiles by name, nickname, or email
    try {
      const { data: profiles, error: pErr } = await admin
        .from('profiles')
        .select(`
          id,
          name,
          nickname,
          email,
          birth_date,
          category,
          rating,
          rating_deviation,
          matches_played,
          declared_level
        `)
        .or(`name.ilike.%${trimmed}%,nickname.ilike.%${trimmed}%,email.ilike.%${trimmed}%`)
        .limit(8);

      if (!pErr && profiles) {
        for (const p of profiles) {
          const displayName = p.nickname || p.name;
          const key = `profile_${p.id}`;
          map.set(key, {
            id: p.id,
            name: displayName,
            nickname: p.nickname || undefined,
            canonicalName: p.name,
            emailMasked: obfuscateEmail(p.email),
            emailReal: p.email || undefined,
            birthDate: p.birth_date || undefined,
            category: (p.category as any) || undefined,
            rating: Math.round(p.rating ?? 1500),
            ratingDeviation: Math.round(p.rating_deviation ?? 350),
            matchesPlayed: p.matches_played ?? 0,
            declaredLevel: p.declared_level ? Number(p.declared_level) : undefined,
            source: 'profile',
          });
        }
      }
    } catch {
      // Gracefully continue to historical search if profiles search fails
    }

    // 2. Search canonical players in historical archive
    try {
      const { data: players, error: plErr } = await admin
        .from('players')
        .select(`
          id,
          canonical_name,
          user_id,
          rating_states:rating_states(rating, rating_deviation, matches_played)
        `)
        .ilike('canonical_name', `%${trimmed}%`)
        .limit(8);

      if (!plErr && players) {
        for (const p of players) {
          const alreadyMatched = Array.from(map.values()).some(
            (item) => item.name.toLowerCase() === p.canonical_name.toLowerCase()
          );
          if (alreadyMatched) continue;

          const rs = Array.isArray(p.rating_states) ? p.rating_states[0] : p.rating_states;
          const rating = rs?.rating ? Math.round(rs.rating) : 1500;
          const rd = rs?.rating_deviation ? Math.round(rs.rating_deviation) : 350;
          const matchesPlayed = rs?.matches_played ?? 0;

          map.set(`player_${p.id}`, {
            id: p.id,
            name: p.canonical_name,
            canonicalName: p.canonical_name,
            emailMasked: '',
            rating,
            ratingDeviation: rd,
            matchesPlayed,
            source: 'historical',
          });
        }
      }
    } catch {
      // Ignore
    }

    // 3. Search aliases in historical archive
    try {
      const { data: aliases, error: alErr } = await admin
        .from('player_aliases')
        .select(`
          alias,
          players:player_id (
            id,
            canonical_name,
            user_id,
            rating_states:rating_states(rating, rating_deviation, matches_played)
          )
        `)
        .ilike('alias', `%${trimmed}%`)
        .limit(8);

      if (!alErr && aliases) {
        for (const a of aliases) {
          const p = a.players as any;
          if (!p) continue;
          const alreadyMatched = Array.from(map.values()).some(
            (item) => item.name.toLowerCase() === a.alias.toLowerCase()
          );
          if (alreadyMatched) continue;

          const rs = Array.isArray(p.rating_states) ? p.rating_states[0] : p.rating_states;
          const rating = rs?.rating ? Math.round(rs.rating) : 1500;
          const rd = rs?.rating_deviation ? Math.round(rs.rating_deviation) : 350;
          const matchesPlayed = rs?.matches_played ?? 0;

          map.set(`alias_${a.alias}_${p.id}`, {
            id: p.id,
            name: a.alias,
            canonicalName: p.canonical_name,
            matchedAlias: a.alias,
            emailMasked: '',
            rating,
            ratingDeviation: rd,
            matchesPlayed,
            source: 'historical',
          });
        }
      }
    } catch {
      // Ignore
    }

    return {
      success: true,
      data: Array.from(map.values()),
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Error buscando jugadores',
    };
  }
}

/** Legacy alias for backward compatibility */
export const searchHistoricalPlayersAction = searchExistingPlayersAction;

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

    const admin = createAdminClient();

    // 1. Check profiles
    const { data: profile } = await admin
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
    const { data: canonical } = await admin
      .from('players')
      .select('id, canonical_name, category')
      .ilike('canonical_name', trimmed.split('@')[0] || '')
      .maybeSingle();

    if (canonical) {
      const { data: ratingState } = await admin
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
          category: canonical.category as any,
        },
      };
    }

    return { success: true, data: { found: false } };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Error buscando jugador' };
  }
}

/**
 * Public: Join a tournament with profile details.
 * Decoupled from auth.users, assigns Glicko-2 ratings, and issues secure session cookie.
 */
export async function publicJoinTournamentAction(formData: {
  tournamentIdOrSlug: string;
  email: string;
  name: string;
  birthDateOrAge: string | number;
  declaredLevel: number;
  historicalPlayerId?: string;
  historicalRating?: number;
}): Promise<ActionResponse<{ participantId: string; category: string; rating: number }>> {
  try {
    const admin = createAdminClient();

    // 1. Resolve tournament safely (dual lookup: UUID or slug)
    const rawParam = decodeURIComponent(formData.tournamentIdOrSlug).trim();
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    let tournament = null;

    if (UUID_REGEX.test(rawParam)) {
      const { data } = await admin
        .from('tournaments')
        .select('*')
        .eq('id', rawParam)
        .maybeSingle();
      tournament = data;
    }

    if (!tournament) {
      const { data: bySlug } = await admin
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

        const { data: byNorm } = await admin
          .from('tournaments')
          .select('*')
          .eq('slug', normalizedSlug)
          .maybeSingle();
        tournament = byNorm;
      }

      if (!tournament) {
        const { data: byIlike } = await admin
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
    if (st !== 'registration' && st !== 'draft' && st !== 'group_stage') {
      return { success: false, error: 'Las inscripciones para este torneo están cerradas' };
    }

    const referenceCutoff = (tournament as any).start_date || tournament.created_at;
    const category = determineAgeCategory(formData.birthDateOrAge, referenceCutoff);
    const clampedLevel = Math.max(0, Math.min(10, Number(formData.declaredLevel) || 5));

    // Dynamic rating query for MIN and MAX bounds
    const { data: minState } = await admin
      .from('rating_states')
      .select('rating')
      .order('rating', { ascending: true })
      .limit(1)
      .maybeSingle();

    const { data: maxState } = await admin
      .from('rating_states')
      .select('rating')
      .order('rating', { ascending: false })
      .limit(1)
      .maybeSingle();

    const minElo = minState?.rating ?? FALLBACK_MIN_ELO;
    const maxElo = maxState?.rating ?? FALLBACK_MAX_ELO;

    // Check if user is currently authenticated via Supabase Auth
    const userClient = await createClient();
    const { data: { user } } = await userClient.auth.getUser();

    const cleanEmail = formData.email.trim().toLowerCase();

    // Check if profile exists by email or auth user id
    let targetUserId = user?.id;

    if (!targetUserId) {
      const { data: existingProfile } = await admin
        .from('profiles')
        .select('id, rating')
        .ilike('email', cleanEmail)
        .maybeSingle();

      if (existingProfile) {
        targetUserId = existingProfile.id;
      }
    }

    // Determine initial rating:
    // 1. If explicitly chosen from historical suggestion
    // 2. Or matching historical canonical player
    // 3. Or calculated from declared level
    let assignedRating: number;
    let initialRd = 350;
    let initialVol = 0.06;

    if (formData.historicalRating && formData.historicalRating > 0) {
      assignedRating = formData.historicalRating;
    } else {
      // Check if canonical player exists with historical rating
      const { data: canonical } = await admin
        .from('players')
        .select(`
          id,
          rating_states:rating_states(rating, rating_deviation, volatility)
        `)
        .or(`canonical_name.ilike.${formData.name.trim()},email.ilike.${cleanEmail}`)
        .limit(1)
        .maybeSingle();

      const rs = canonical?.rating_states
        ? (Array.isArray(canonical.rating_states) ? canonical.rating_states[0] : canonical.rating_states)
        : null;

      if (rs?.rating) {
        assignedRating = Math.round(rs.rating);
        initialRd = Math.round(rs.rating_deviation ?? 350);
        initialVol = rs.volatility ?? 0.06;
      } else {
        const prov = calculateProvisionalRating(clampedLevel, minElo, maxElo);
        assignedRating = prov.rating;
      }
    }

    // Create or update profile
    if (!targetUserId) {
      const newUserId = crypto.randomUUID();
      const { error: profErr } = await admin.from('profiles').insert({
        id: newUserId,
        user_id: user?.id ?? null,
        name: formData.name.trim(),
        email: cleanEmail,
        role: 'player',
        admin_status: 'none',
        declared_level: clampedLevel,
        category,
        rating: assignedRating,
        rating_deviation: initialRd,
        volatility: initialVol,
      });

      if (profErr && profErr.code !== '23505') {
        return { success: false, error: `Error creando perfil: ${profErr.message}` };
      }
      targetUserId = newUserId;
    } else {
      await admin
        .from('profiles')
        .update({
          category,
          declared_level: clampedLevel,
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetUserId);
    }

    // Check if player is already registered in this tournament
    const { data: existingParticipant } = await admin
      .from('tournament_participants')
      .select('user_id')
      .eq('tournament_id', tournament.id)
      .eq('user_id', targetUserId)
      .maybeSingle();

    if (existingParticipant) {
      return { success: false, error: 'Ya estás inscrito en este torneo con este correo electrónico.' };
    }

    // Insert into tournament_participants
    const { error: partErr } = await admin
      .from('tournament_participants')
      .insert({
        tournament_id: tournament.id,
        user_id: targetUserId,
        category,
        declared_level: clampedLevel,
      });

    if (partErr) {
      return { success: false, error: `Error en la inscripción: ${partErr.message}` };
    }

    // Set cryptographically signed session cookie for the player
    await setPlayerSessionCookie({
      playerId: targetUserId,
      email: cleanEmail,
      tournamentId: tournament.id,
    });

    // Also persist legacy identifier cookies for compatibility
    const cookieStore = await cookies();
    cookieStore.set('tourneymaster_player_id', targetUserId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 60, // 60 days
      path: '/',
    });
    cookieStore.set('tourneymaster_player_name', formData.name.trim(), {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 60,
      path: '/',
    });

    await admin.from('audit_logs').insert({
      actor_id: targetUserId,
      action: 'public_join_tournament',
      entity_type: 'tournament_participants',
      entity_id: `${tournament.id}_${targetUserId}`,
      new_data: { category, declared_level: clampedLevel, rating: assignedRating },
    });

    revalidatePath(`/join/${formData.tournamentIdOrSlug}`);
    revalidatePath(`/t/${tournament.slug}`);
    revalidatePath(`/admin/tournaments/${tournament.id}`);
    revalidatePath('/player');

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
