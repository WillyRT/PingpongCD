'use server';

import { createClient, createAdminClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { resolveDisputeSchema } from '@/lib/validation/schemas';
import { validateScoreForStage, determineWinner } from '@/lib/engine/scoring';
import { determineAgeCategory } from '@/lib/engine/categories';
import { getPlayerSession } from '@/lib/auth/player-session';
import type { ActionResponse } from './tournament';

/** Helper to verify if user has admin/referee privileges based solely on database RBAC */
export async function verifyAdminUser(): Promise<{
  authorized: boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isReferee: boolean;
  userId?: string;
  role?: string;
  adminStatus?: string;
  error?: string;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { authorized: false, isSuperAdmin: false, isAdmin: false, isReferee: false, error: 'Unauthorized' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, admin_status')
    .eq('id', user.id)
    .single();

  const isSuperAdmin = profile?.role === 'super_admin' || user.email?.toLowerCase() === 'guillermoriveraterriza@gmail.com';
  const isAdmin = isSuperAdmin || (profile?.role === 'admin' && profile?.admin_status === 'approved');
  const isReferee = profile?.role === 'referee';

  return {
    authorized: isAdmin || isReferee,
    isSuperAdmin,
    isAdmin,
    isReferee,
    userId: user.id,
    role: profile?.role,
    adminStatus: profile?.admin_status,
  };
}

/**
 * Superadmin Role Management Action:
 * - targetUserId: UUID of the profile
 * - newRole: 'player' | 'referee' | 'admin'
 * 
 * Rules:
 * - Only super_admin or guillermoriveraterriza@gmail.com can call this.
 * - Root superadmin cannot be modified.
 * - Updates role and sets admin_status ('approved' for admin/referee, null for player).
 * - Revalidates /admin, /admin/users, /tables, /me.
 */
export async function updateUserRoleAction(
  targetUserId: string,
  newRole: 'player' | 'referee' | 'admin'
): Promise<ActionResponse> {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();
    const { data: { user } } = await supabase.auth.getUser();
    const playerSession = await getPlayerSession();

    const callerEmail = user?.email || playerSession?.email;
    const cleanCallerEmail = callerEmail?.toLowerCase().trim();

    let isCallerSuperAdmin = cleanCallerEmail === 'guillermoriveraterriza@gmail.com';

    if (!isCallerSuperAdmin && cleanCallerEmail) {
      const { data: callerProfile } = await adminClient
        .from('profiles')
        .select('role')
        .eq('email', cleanCallerEmail)
        .maybeSingle();
      isCallerSuperAdmin = callerProfile?.role === 'super_admin';
    }

    if (!isCallerSuperAdmin) {
      return {
        success: false,
        error: 'Acceso denegado: Solo el Superadministrador puede gestionar los roles del staff.',
      };
    }

    const { data: targetProfile } = await adminClient
      .from('profiles')
      .select('id, email, role')
      .eq('id', targetUserId)
      .maybeSingle();

    if (!targetProfile) {
      return { success: false, error: 'Usuario no encontrado.' };
    }

    const targetEmail = targetProfile.email?.toLowerCase().trim();
    if (targetEmail === 'guillermoriveraterriza@gmail.com' || targetProfile.role === 'super_admin') {
      return {
        success: false,
        error: 'No se puede modificar el rol del Superadministrador principal.',
      };
    }

    const newAdminStatus = newRole === 'player' ? null : 'approved';

    const { error } = await adminClient
      .from('profiles')
      .update({
        role: newRole,
        admin_status: newAdminStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', targetUserId);

    if (error) {
      return { success: false, error: `Error actualizando rol: ${error.message}` };
    }

    try {
      await adminClient.from('audit_logs').insert({
        actor_id: user?.id || playerSession?.playerId || 'super-admin',
        action: 'update_user_role',
        entity_type: 'profiles',
        entity_id: targetUserId,
        previous_data: { role: targetProfile.role },
        new_data: { role: newRole, admin_status: newAdminStatus },
      });
    } catch {
      // Audit log optional
    }

    revalidatePath('/admin');
    revalidatePath('/admin/users');
    revalidatePath('/tables');
    revalidatePath('/me');

    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Error al actualizar el rol',
    };
  }
}

/**
 * Role Promotion/Demotion alias (backward compatible):
 */
export async function setUserRoleAction(
  targetUserId: string,
  newRole: 'admin' | 'referee' | 'player'
): Promise<ActionResponse> {
  return updateUserRoleAction(targetUserId, newRole);
}

/**
 * Assign a match to one of the 4 stations/tables (1, 2, 3, 4) or unassign.
 * Callable by referee, admin, or super_admin.
 */
export async function assignMatchTableAction(
  matchId: string,
  tableNumber: number | null
): Promise<ActionResponse> {
  try {
    const auth = await verifyAdminUser();
    if (!auth.authorized) {
      return { success: false, error: 'Acceso no autorizado' };
    }

    if (tableNumber !== null && (tableNumber < 1 || tableNumber > 4)) {
      return { success: false, error: 'El número de mesa debe ser 1, 2, 3 o 4.' };
    }

    const adminClient = createAdminClient();
    const { data: match, error: mErr } = await adminClient
      .from('matches')
      .select('tournament_id, status, table_number')
      .eq('id', matchId)
      .single();

    if (mErr || !match) return { success: false, error: 'Partido no encontrado' };

    const newStatus = (tableNumber !== null && (match.status === 'pending' || match.status === 'scheduled'))
      ? 'in_progress'
      : match.status;

    const { error } = await adminClient
      .from('matches')
      .update({
        table_number: tableNumber,
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', matchId);

    if (error) return { success: false, error: error.message };

    revalidatePath(`/admin/tournaments/${match.tournament_id}`);
    revalidatePath(`/admin/tournaments/${match.tournament_id}/stations`);
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Error asignando mesa' };
  }
}

/**
 * Superadmin: Approve a user as administrator.
 * Exclusively callable by guillermoriveraterriza@gmail.com / super_admin.
 */
export async function approveAdminAction(targetUserId: string): Promise<ActionResponse> {
  try {
    const auth = await verifyAdminUser();
    if (!auth.isSuperAdmin) {
      return { success: false, error: 'Solo el Superadmin principal puede otorgar permisos de administrador.' };
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from('profiles')
      .update({
        role: 'admin',
        admin_status: 'approved',
      })
      .eq('id', targetUserId);

    if (error) return { success: false, error: error.message };

    await supabase.from('audit_logs').insert({
      actor_id: auth.userId,
      action: 'approve_admin',
      entity_type: 'profiles',
      entity_id: targetUserId,
      new_data: { role: 'admin', admin_status: 'approved' },
    });

    revalidatePath('/admin');
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Superadmin: Revoke administrator permissions from a user.
 * Exclusively callable by guillermoriveraterriza@gmail.com / super_admin.
 */
export async function revokeAdminAction(targetUserId: string): Promise<ActionResponse> {
  try {
    const auth = await verifyAdminUser();
    if (!auth.isSuperAdmin) {
      return { success: false, error: 'Solo el Superadmin principal puede revocar permisos de administrador.' };
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from('profiles')
      .update({
        role: 'player',
        admin_status: 'rejected',
      })
      .eq('id', targetUserId);

    if (error) return { success: false, error: error.message };

    await supabase.from('audit_logs').insert({
      actor_id: auth.userId,
      action: 'revoke_admin',
      entity_type: 'profiles',
      entity_id: targetUserId,
      new_data: { role: 'player', admin_status: 'rejected' },
    });

    revalidatePath('/admin');
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Player: Request administrator access (sets admin_status = 'pending').
 */
export async function requestAdminAccessAction(): Promise<ActionResponse> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    const { error } = await supabase
      .from('profiles')
      .update({ admin_status: 'pending' })
      .eq('id', user.id);

    if (error) return { success: false, error: error.message };

    revalidatePath('/admin');
    revalidatePath('/player');
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Superadmin: List all users for RBAC management.
 */
export async function listAdminUsersAction(): Promise<ActionResponse<any[]>> {
  try {
    const auth = await verifyAdminUser();
    if (!auth.isSuperAdmin) {
      return { success: false, error: 'Unauthorized' };
    }

    const supabase = await createClient();
    const { data: users, error } = await supabase
      .from('profiles')
      .select('id, name, email, role, admin_status, created_at')
      .order('created_at', { ascending: false });

    if (error) return { success: false, error: error.message };

    return { success: true, data: users ?? [] };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Admin: Resolve a disputed match.
 */
export async function resolveDisputeAction(input: {
  matchId: string;
  resolution: 'accept_score' | 'modify_score' | 'cancel_match' | 'reopen_match';
  scorePlayer1?: number;
  scorePlayer2?: number;
  notes?: string;
}): Promise<ActionResponse> {
  try {
    const parsed = resolveDisputeSchema.parse(input);
    const auth = await verifyAdminUser();
    if (!auth.authorized) {
      return { success: false, error: 'Only admins can resolve disputes' };
    }

    const supabase = await createClient();
    const { data: match } = await supabase
      .from('matches')
      .select('*')
      .eq('id', parsed.matchId)
      .single();

    if (!match) return { success: false, error: 'Match not found' };

    if (parsed.resolution === 'reopen_match' || parsed.resolution === 'cancel_match') {
      await supabase
        .from('matches')
        .update({
          status: 'pending',
          score_player1: null,
          score_player2: null,
          winner_id: null,
          reported_by: null,
          confirmed_by: null,
          confirmed_at: null,
        })
        .eq('id', parsed.matchId);

      await supabase.from('audit_logs').insert({
        actor_id: auth.userId,
        action: `resolve_dispute_${parsed.resolution}`,
        entity_type: 'matches',
        entity_id: parsed.matchId,
        previous_data: { status: match.status },
        new_data: { status: 'pending', notes: parsed.notes },
      });
    } else if (parsed.resolution === 'accept_score') {
      const winnerNumber = determineWinner(match.score_player1 ?? 0, match.score_player2 ?? 0);
      const winnerId = winnerNumber === 1 ? match.player1_id : match.player2_id;

      await supabase
        .from('matches')
        .update({
          status: 'confirmed',
          winner_id: winnerId,
          confirmed_by: auth.userId,
          confirmed_at: new Date().toISOString(),
        })
        .eq('id', parsed.matchId);

      await supabase.from('audit_logs').insert({
        actor_id: auth.userId,
        action: 'resolve_dispute_accept_score',
        entity_type: 'matches',
        entity_id: parsed.matchId,
        previous_data: { status: match.status },
        new_data: { status: 'confirmed', winner_id: winnerId, notes: parsed.notes },
      });
    } else if (parsed.resolution === 'modify_score') {
      if (parsed.scorePlayer1 === undefined || parsed.scorePlayer2 === undefined) {
        return { success: false, error: 'Scores required for modify_score resolution' };
      }

      const validation = validateScoreForStage(parsed.scorePlayer1, parsed.scorePlayer2, match.stage as any);
      if (!validation.valid) {
        return { success: false, error: validation.reason || 'Invalid score' };
      }

      const winnerNumber = determineWinner(parsed.scorePlayer1, parsed.scorePlayer2);
      const winnerId = winnerNumber === 1 ? match.player1_id : match.player2_id;

      await supabase
        .from('matches')
        .update({
          status: 'confirmed',
          score_player1: parsed.scorePlayer1,
          score_player2: parsed.scorePlayer2,
          winner_id: winnerId,
          confirmed_by: auth.userId,
          confirmed_at: new Date().toISOString(),
        })
        .eq('id', parsed.matchId);

      await supabase.from('audit_logs').insert({
        actor_id: auth.userId,
        action: 'resolve_dispute_modify_score',
        entity_type: 'matches',
        entity_id: parsed.matchId,
        previous_data: { status: match.status, s1: match.score_player1, s2: match.score_player2 },
        new_data: {
          status: 'confirmed',
          score_player1: parsed.scorePlayer1,
          score_player2: parsed.scorePlayer2,
          winner_id: winnerId,
          notes: parsed.notes,
        },
      });
    }

    revalidatePath(`/admin/tournaments/${match.tournament_id}`);
    revalidatePath('/player');
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export interface UpdateParticipantInput {
  tournamentId: string;
  userId: string;
  name: string;
  nickname?: string;
  email?: string;
  birthDateOrAge?: string;
  declaredLevel?: number;
}

/**
 * Admin: Update participant details (Nickname, Name, Email, Birthdate/Category, Level).
 * Synchronizes profiles and tournament_participants.
 */
export async function updateParticipantAction(
  input: UpdateParticipantInput
): Promise<ActionResponse> {
  try {
    const auth = await verifyAdminUser();
    if (!auth.authorized) {
      return { success: false, error: 'Acceso no autorizado. Se requieren permisos de administrador.' };
    }

    const admin = createAdminClient();
    const cleanName = input.name.trim();
    if (!cleanName) {
      return { success: false, error: 'El nombre / nickname no puede estar vacío.' };
    }

    const cleanNickname = (input.nickname || cleanName).trim();
    const cleanEmail = input.email?.trim().toLowerCase() || null;
    const clampedLevel = Math.max(0, Math.min(10, Number(input.declaredLevel) || 5));

    // Fetch tournament to determine reference date for category
    const { data: tournament } = await admin
      .from('tournaments')
      .select('*')
      .eq('id', input.tournamentId)
      .single();

    if (!tournament) return { success: false, error: 'Torneo no encontrado' };

    const refDate = (tournament as any).start_date || tournament.created_at;
    const category = input.birthDateOrAge
      ? determineAgeCategory(input.birthDateOrAge, refDate)
      : 'plus14';

    // 1. Update Profile
    const profileUpdate: Record<string, any> = {
      name: cleanName,
      nickname: cleanNickname,
      email: cleanEmail,
      category,
      declared_level: clampedLevel,
      updated_at: new Date().toISOString(),
    };

    if (input.birthDateOrAge && input.birthDateOrAge.includes('-')) {
      profileUpdate.birth_date = input.birthDateOrAge;
    }

    await admin
      .from('profiles')
      .update(profileUpdate)
      .eq('id', input.userId);

    // 2. Update Tournament Participant
    await admin
      .from('tournament_participants')
      .update({
        category,
        declared_level: clampedLevel,
      })
      .eq('tournament_id', input.tournamentId)
      .eq('user_id', input.userId);

    // 3. Audit Log
    await admin.from('audit_logs').insert({
      actor_id: auth.userId,
      action: 'admin_update_participant',
      entity_type: 'tournament_participants',
      entity_id: `${input.tournamentId}_${input.userId}`,
      new_data: { name: cleanName, nickname: cleanNickname, email: cleanEmail, category, declared_level: clampedLevel },
    });

    revalidatePath(`/admin/tournaments/${input.tournamentId}`);
    revalidatePath(`/t/${tournament.slug}`);
    revalidatePath('/me');
    revalidatePath('/player');

    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Error actualizando participante' };
  }
}

export interface DeleteParticipantInput {
  tournamentId: string;
  userId: string;
}

/**
 * Admin: Delete or Withdraw participant from tournament.
 * - In registration/draft phase: removes participant cleanly.
 * - In active phase (group_stage/bracket_stage): processes W.O. on pending matches without corrupting data integrity.
 */
export async function deleteParticipantAction(
  input: DeleteParticipantInput
): Promise<ActionResponse> {
  try {
    const auth = await verifyAdminUser();
    if (!auth.authorized) {
      return { success: false, error: 'Acceso no autorizado. Se requieren permisos de administrador.' };
    }

    const admin = createAdminClient();

    const { data: tournament } = await admin
      .from('tournaments')
      .select('*')
      .eq('id', input.tournamentId)
      .single();

    if (!tournament) return { success: false, error: 'Torneo no encontrado' };

    const status = tournament.status;

    if (status === 'draft' || status === 'registration') {
      // Clean removal during registration phase
      await admin
        .from('tournament_participants')
        .delete()
        .eq('tournament_id', input.tournamentId)
        .eq('user_id', input.userId);

      // Decrement total_players in config if present
      const { data: config } = await admin
        .from('tournament_config')
        .select('total_players')
        .eq('tournament_id', input.tournamentId)
        .maybeSingle();

      if (config && config.total_players && config.total_players > 0) {
        await admin
          .from('tournament_config')
          .update({ total_players: config.total_players - 1 })
          .eq('tournament_id', input.tournamentId);
      }
    } else {
      // Active tournament (group_stage or bracket_stage):
      // Fetch all matches for this participant in this tournament
      const { data: matches } = await admin
        .from('matches')
        .select('*')
        .eq('tournament_id', input.tournamentId)
        .or(`player1_id.eq.${input.userId},player2_id.eq.${input.userId}`);

      if (matches) {
        for (const m of matches) {
          if (m.status === 'pending' || m.status === 'submitted') {
            // Process Walkover (W.O.): Opponent wins with standard default score
            const isP1 = m.player1_id === input.userId;
            const winnerId = isP1 ? m.player2_id : m.player1_id;
            const targetScore = m.stage === 'group' ? 7 : 11;

            await admin
              .from('matches')
              .update({
                status: 'confirmed',
                winner_id: winnerId,
                score_player1: isP1 ? 0 : targetScore,
                score_player2: isP1 ? targetScore : 0,
                confirmed_by: auth.userId,
                confirmed_at: new Date().toISOString(),
              })
              .eq('id', m.id);

            // Advance winner in bracket if knockout stage
            if (m.next_match_id && m.next_slot) {
              const slotField = m.next_slot === 1 ? 'player1_id' : 'player2_id';
              await admin
                .from('matches')
                .update({ [slotField]: winnerId, updated_at: new Date().toISOString() })
                .eq('id', m.next_match_id);
            }
          }
        }
      }

      // Remove from tournament participants
      await admin
        .from('tournament_participants')
        .delete()
        .eq('tournament_id', input.tournamentId)
        .eq('user_id', input.userId);
    }

    await admin.from('audit_logs').insert({
      actor_id: auth.userId,
      action: 'admin_delete_participant',
      entity_type: 'tournament_participants',
      entity_id: `${input.tournamentId}_${input.userId}`,
      new_data: { phase: status },
    });

    revalidatePath(`/admin/tournaments/${input.tournamentId}`);
    revalidatePath(`/t/${tournament.slug}`);
    revalidatePath('/me');
    revalidatePath('/player');

    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Error eliminando participante' };
  }
}

export interface AdminAddParticipantInput {
  tournamentId: string;
  name: string;
  nickname?: string;
  email?: string;
  birthDateOrAge?: string;
  declaredLevel?: number;
  rating?: number;
}

/**
 * Admin: Directly add and confirm a participant to a tournament (Bypass Seguro).
 * Exclusively callable by approved admins / super_admin without email verification.
 */
export async function adminAddParticipantAction(
  input: AdminAddParticipantInput
): Promise<ActionResponse<{ participantId: string; category: string; rating: number }>> {
  try {
    const auth = await verifyAdminUser();
    if (!auth.authorized) {
      return { success: false, error: 'Acceso no autorizado. Se requieren permisos de administrador.' };
    }

    const admin = createAdminClient();
    const cleanName = input.name.trim();
    if (!cleanName) {
      return { success: false, error: 'El nombre del participante no puede estar vacío.' };
    }

    const cleanNickname = (input.nickname || cleanName).trim();
    const cleanEmail = input.email ? input.email.trim().toLowerCase() : null;
    const clampedLevel = Math.max(0, Math.min(10, Number(input.declaredLevel) || 5));

    // Fetch tournament
    const { data: tournament } = await admin
      .from('tournaments')
      .select('*')
      .eq('id', input.tournamentId)
      .single();

    if (!tournament) return { success: false, error: 'Torneo no encontrado' };

    const refDate = (tournament as any).start_date || tournament.created_at;
    const category = input.birthDateOrAge
      ? determineAgeCategory(input.birthDateOrAge, refDate)
      : 'plus14';

    // Find or create profile
    let targetUserId: string | null = null;
    let initialRating = input.rating ?? 1500;

    if (cleanEmail) {
      const { data: existingProf } = await admin
        .from('profiles')
        .select('id, rating')
        .ilike('email', cleanEmail)
        .maybeSingle();

      if (existingProf) {
        targetUserId = existingProf.id;
        if (!input.rating && existingProf.rating) {
          initialRating = Math.round(existingProf.rating);
        }
      }
    }

    if (!targetUserId) {
      // Also check by name
      const { data: existingByName } = await admin
        .from('profiles')
        .select('id, rating')
        .ilike('name', cleanName)
        .maybeSingle();

      if (existingByName) {
        targetUserId = existingByName.id;
        if (!input.rating && existingByName.rating) {
          initialRating = Math.round(existingByName.rating);
        }
      }
    }

    if (!targetUserId) {
      targetUserId = crypto.randomUUID();
      await admin.from('profiles').insert({
        id: targetUserId,
        name: cleanName,
        nickname: cleanNickname,
        email: cleanEmail,
        category,
        declared_level: clampedLevel,
        rating: initialRating,
        role: 'player',
        admin_status: 'none',
      });
    } else {
      await admin
        .from('profiles')
        .update({
          nickname: cleanNickname,
          category,
          declared_level: clampedLevel,
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetUserId);
    }

    // Check if already registered
    const { data: existingPart } = await admin
      .from('tournament_participants')
      .select('user_id')
      .eq('tournament_id', input.tournamentId)
      .eq('user_id', targetUserId)
      .maybeSingle();

    if (existingPart) {
      return { success: false, error: 'Este participante ya está inscrito en el torneo.' };
    }

    // Insert directly into tournament_participants
    const { error: partErr } = await admin
      .from('tournament_participants')
      .insert({
        tournament_id: input.tournamentId,
        user_id: targetUserId,
        category,
        declared_level: clampedLevel,
      });

    if (partErr) {
      return { success: false, error: `Error inscribiendo participante: ${partErr.message}` };
    }

    // Audit log
    await admin.from('audit_logs').insert({
      actor_id: auth.userId,
      action: 'admin_add_participant',
      entity_type: 'tournament_participants',
      entity_id: `${input.tournamentId}_${targetUserId}`,
      new_data: {
        category,
        declared_level: clampedLevel,
        rating: initialRating,
        direct_admin_enrollment: true,
      },
    });

    revalidatePath(`/admin/tournaments/${input.tournamentId}`);
    revalidatePath(`/t/${tournament.slug}`);
    revalidatePath('/me');
    revalidatePath('/player');

    return {
      success: true,
      data: {
        participantId: targetUserId,
        category,
        rating: initialRating,
      },
    };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Error inesperado añadiendo participante' };
  }
}

/**
 * Player: Update grip style and rubber type (informative badges only, no rating impact).
 */
export async function updatePlayerMaterialAction(input: {
  gripStyle?: 'shakehand' | 'penhold' | null;
  rubberType?: string | null;
}): Promise<ActionResponse> {
  try {
    const supabase = await createClient();
    const admin = createAdminClient();
    const { data: { user } } = await supabase.auth.getUser();
    const playerSession = await getPlayerSession();

    const callerId = user?.id || playerSession?.playerId;
    if (!callerId) return { success: false, error: 'Se requiere sesión activa' };

    await admin
      .from('profiles')
      .update({
        grip_style: input.gripStyle ?? null,
        rubber_type: input.rubberType?.trim() ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', callerId);

    revalidatePath('/me');
    revalidatePath('/player');
    revalidatePath('/tables');
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Error actualizando material' };
  }
}
