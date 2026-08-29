'use server';

import { cookies } from 'next/headers';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { createPlayerSessionToken, PLAYER_SESSION_COOKIE_OPTIONS } from '@/lib/auth/player-session';

export interface LoginSyncResult {
  success: boolean;
  role: string;
  destination: string;
  error?: string;
}

/**
 * Synchronizes session after password login, ensuring player session cookie is issued
 * and direct routing destination (/admin or /me) is returned.
 */
export async function syncLoginSessionAction(email: string): Promise<LoginSyncResult> {
  try {
    const admin = createAdminClient();
    const normalizedEmail = email.toLowerCase().trim();

    // Check profile
    let { data: profile } = await admin
      .from('profiles')
      .select('id, role, name, nickname, admin_status')
      .eq('email', normalizedEmail)
      .maybeSingle();

    const isSuperAdmin = normalizedEmail === 'guillermoriveraterriza@gmail.com' || profile?.role === 'super_admin';
    const role = isSuperAdmin ? 'super_admin' : (profile?.role || 'player');
    const isAdmin = isSuperAdmin || (role === 'admin' && profile?.admin_status === 'approved') || role === 'referee';

    // If profile is missing for a registered user, auto-provision
    if (!profile) {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const fallbackName = user.user_metadata?.name || normalizedEmail.split('@')[0];
        const newProfile = {
          id: user.id,
          name: fallbackName,
          nickname: fallbackName,
          email: normalizedEmail,
          role: isSuperAdmin ? 'super_admin' : 'player',
          admin_status: isSuperAdmin ? 'approved' : 'none',
          category: 'plus14',
          rating: 1500,
          rating_deviation: 350,
          volatility: 0.06,
          matches_played: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        await admin.from('profiles').upsert(newProfile, { onConflict: 'id' });
        profile = newProfile as any;
      }
    }

    // If player, issue signed tourneymaster_session cookie
    if (role === 'player' && profile) {
      const token = await createPlayerSessionToken({
        playerId: profile.id,
        email: normalizedEmail,
      });
      const cookieStore = await cookies();
      cookieStore.set('tourneymaster_session', token, PLAYER_SESSION_COOKIE_OPTIONS);
    }

    return {
      success: true,
      role,
      destination: isAdmin ? '/admin' : '/me',
    };
  } catch (err: any) {
    return {
      success: false,
      role: 'player',
      destination: '/me',
      error: err?.message || 'Error al sincronizar sesión',
    };
  }
}
