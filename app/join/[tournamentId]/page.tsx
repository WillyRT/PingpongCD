import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { PublicJoinClient } from './PublicJoinClient';

interface PageProps {
  params: Promise<{ tournamentId: string }>;
}

export default async function PublicJoinPage({ params }: PageProps) {
  const { tournamentId } = await params;
  const supabase = await createClient();

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('*')
    .or(`id.eq.${tournamentId},slug.eq.${tournamentId}`)
    .single();

  if (!tournament) notFound();

  // Fetch participant count
  const { count: participantCount } = await supabase
    .from('tournament_participants')
    .select('*', { count: 'exact', head: true })
    .eq('tournament_id', tournament.id);

  // Check if current authenticated user
  const { data: { user } } = await supabase.auth.getUser();
  let existingProfile = null;
  if (user) {
    const { data: prof } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    existingProfile = prof;
  }

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-8 flex flex-col items-center justify-center">
      <PublicJoinClient
        tournament={tournament}
        participantCount={participantCount ?? 0}
        currentUser={user ? { id: user.id, email: user.email ?? '' } : null}
        existingProfile={existingProfile}
      />
    </main>
  );
}
