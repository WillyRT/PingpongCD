import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getPlayerSession } from '@/lib/auth/player-session';
import { notFound, redirect } from 'next/navigation';
import { isSuperAdminProfile } from '@/lib/auth/rbac';
import { StationsClient } from './StationsClient';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TournamentStationsPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  const playerSession = await getPlayerSession();
  const callerEmail = user?.email || playerSession?.email;
  const callerId = user?.id || playerSession?.playerId;

  if (!callerEmail && !callerId) {
    redirect(`/login?redirectTo=/admin/tournaments/${id}/stations`);
  }

  // Verify referee or admin role
  let userProfile: any = null;

  if (callerEmail) {
    const cleanEmail = callerEmail.toLowerCase().trim();
    const { data: profile } = await admin
      .from('profiles')
      .select('id, role, admin_status, email')
      .eq('email', cleanEmail)
      .maybeSingle();
    userProfile = profile;
  } else if (callerId) {
    const { data: profile } = await admin
      .from('profiles')
      .select('id, role, admin_status, email')
      .eq('id', callerId)
      .maybeSingle();
    userProfile = profile;
  }

  const cleanEmail = userProfile?.email?.toLowerCase().trim() || callerEmail?.toLowerCase().trim();
  const isSuperAdmin = isSuperAdminProfile(userProfile || { email: cleanEmail, role: undefined });
  const isAdmin = isSuperAdmin || (userProfile?.role === 'admin' && userProfile?.admin_status === 'approved');
  const isReferee = userProfile?.role === 'referee';

  if (!isAdmin && !isReferee) {
    redirect('/me');
  }

  const effectiveUserId = userProfile?.id || user?.id || playerSession?.playerId || 'referee-user';
  const effectiveRole = isSuperAdmin ? 'super_admin' : isAdmin ? 'admin' : isReferee ? 'referee' : 'referee';

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
      currentUserId={effectiveUserId}
      userRole={effectiveRole}
    />
  );
}
