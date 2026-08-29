import { createClient, createAdminClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import { StationsClient } from './StationsClient';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TournamentStationsPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const admin = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect(`/login?redirectTo=/admin/tournaments/${id}/stations`);

  // Verify referee or admin role
  const { data: profile } = await admin
    .from('profiles')
    .select('role, admin_status, email')
    .eq('id', user.id)
    .maybeSingle();

  const isSuperAdmin =
    profile?.role === 'super_admin' ||
    user.email?.toLowerCase() === 'guillermoriveraterriza@gmail.com';
  const isAdmin = isSuperAdmin || (profile?.role === 'admin' && profile?.admin_status === 'approved');
  const isReferee = profile?.role === 'referee';

  if (!isAdmin && !isReferee) {
    redirect('/me');
  }

  // Fetch tournament
  const { data: tournament } = await admin
    .from('tournaments')
    .select('*')
    .eq('id', id)
    .single();

  if (!tournament) notFound();

  // Fetch groups
  const { data: groups } = await admin
    .from('tournament_groups')
    .select('*')
    .eq('tournament_id', id)
    .order('group_code', { ascending: true });

  // Fetch matches with player info
  const { data: matches } = await admin
    .from('matches')
    .select(`
      *,
      player1:player1_id (id, name, nickname, rating, category),
      player2:player2_id (id, name, nickname, rating, category)
    `)
    .eq('tournament_id', id)
    .order('created_at', { ascending: true });

  return (
    <StationsClient
      tournament={tournament}
      groups={groups || []}
      matches={matches || []}
      currentUserId={user.id}
      userRole={profile?.role || 'referee'}
    />
  );
}
