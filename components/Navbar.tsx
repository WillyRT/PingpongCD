import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getPlayerSession } from '@/lib/auth/player-session';
import { NavbarClient, type NavbarUser } from './NavbarClient';

export async function Navbar() {
  let navbarUser: NavbarUser | null = null;

  try {
    const supabase = await createClient();
    const admin = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    const playerSession = await getPlayerSession();

    const targetUserId = user?.id || playerSession?.playerId;

    if (targetUserId) {
      const { data: profile } = await admin
        .from('profiles')
        .select('id, name, nickname, email, role, rating')
        .or(`id.eq.${targetUserId},user_id.eq.${targetUserId}`)
        .maybeSingle();

      if (profile) {
        navbarUser = {
          id: profile.id,
          name: profile.name,
          nickname: profile.nickname || profile.name,
          email: profile.email,
          role: (profile.role as any) || 'player',
          rating: Math.round(profile.rating ?? 1500),
        };
      }
    }
  } catch {
    // Fail-open: render navbar without crashing
  }

  return <NavbarClient user={navbarUser} />;
}
