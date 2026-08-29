import { createClient, createAdminClient } from '@/lib/supabase/server';
import { HomeClient } from '@/components/HomeClient';
import RecentChampions from '@/components/RecentChampions';
import type { TournamentRow } from '@/lib/types/database';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  let tournaments: TournamentRow[] = [];
  let isAdmin = false;

  try {
    const supabase = await createClient();
    const admin = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();

    if (user?.email) {
      const cleanEmail = user.email.toLowerCase().trim();
      const { data: profile } = await admin
        .from('profiles')
        .select('role, admin_status')
        .eq('email', cleanEmail)
        .maybeSingle();

      isAdmin =
        cleanEmail === 'guillermoriveraterriza@gmail.com' ||
        profile?.role === 'super_admin' ||
        (profile?.role === 'admin' && profile?.admin_status === 'approved');
    }

    const { data } = await admin
      .from('tournaments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    tournaments = data || [];
  } catch {
    tournaments = [];
  }

  return (
    <main className="min-h-screen max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Hero Header */}
      <section className="text-center pt-2">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--primary)]/10 border border-[var(--primary)]/20 text-xs font-semibold text-[var(--primary)] mb-4">
          <span>🏓</span>
          <span>Circuito oficial de Tenis de Mesa Ciudad Ducal</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white mb-4">
          Compite. Diviértete. <span className="text-[var(--primary)]">Domina Ciudad Ducal</span>
        </h1>

        <RecentChampions />
      </section>

      {/* Action Cards & Tournament List */}
      <HomeClient initialTournaments={tournaments} isAdmin={isAdmin} />
    </main>
  );
}
