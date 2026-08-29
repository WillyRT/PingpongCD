import { createAdminClient } from '@/lib/supabase/server';
import { HomeClient } from '@/components/HomeClient';
import type { TournamentRow } from '@/lib/types/database';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  let tournaments: TournamentRow[] = [];

  try {
    const admin = createAdminClient();
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
    <main className="min-h-screen max-w-7xl mx-auto px-4 py-8">
      <HomeClient initialTournaments={tournaments} />
    </main>
  );
}
