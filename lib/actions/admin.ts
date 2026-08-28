'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { resolveDisputeSchema } from '@/lib/validation/schemas';
import { validateScoreForStage, determineWinner } from '@/lib/engine/scoring';
import type { ActionResponse } from './tournament';

/** Helper to verify if user has admin privileges based solely on database RBAC */
export async function verifyAdminUser(): Promise<{
  authorized: boolean;
  isSuperAdmin: boolean;
  userId?: string;
  role?: string;
  adminStatus?: string;
  error?: string;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { authorized: false, isSuperAdmin: false, error: 'Unauthorized' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, admin_status')
    .eq('id', user.id)
    .single();

  const isSuperAdmin = profile?.role === 'super_admin';
  const isAdmin = isSuperAdmin || (profile?.role === 'admin' && profile?.admin_status === 'approved');

  return {
    authorized: isAdmin,
    isSuperAdmin,
    userId: user.id,
    role: profile?.role,
    adminStatus: profile?.admin_status,
  };
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
