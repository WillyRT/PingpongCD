import { createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { AdminTournamentClient } from './AdminTournamentClient';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminTournamentDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login?redirectTo=/admin');

  // Verify admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const isSuperAdmin =
    profile?.role === 'super_admin' ||
    user.email?.toLowerCase() === 'guillermoriveraterriza@gmail.com';

  const isReferee = profile?.role === 'referee';

  if (profile?.role !== 'admin' && !isSuperAdmin && !isReferee) {
    redirect('/me');
  }

  // Fetch tournament
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', id)
    .single();

  if (!tournament) notFound();

  // Fetch config
  const { data: config } = await supabase
    .from('tournament_config')
    .select('*')
    .eq('tournament_id', id)
    .single();

  // Fetch participants
  const { data: participants } = await supabase
    .from('tournament_participants')
    .select('*, profiles:user_id (*)')
    .eq('tournament_id', id)
    .order('seed_number', { ascending: true, nullsFirst: false });

  // Fetch groups
  const { data: groups } = await supabase
    .from('tournament_groups')
    .select('*')
    .eq('tournament_id', id)
    .order('group_code', { ascending: true });

  // Fetch matches
  const { data: matches } = await supabase
    .from('matches')
    .select('*, player1:player1_id (id, name), player2:player2_id (id, name)')
    .eq('tournament_id', id)
    .order('created_at', { ascending: true });

  // Fetch audit logs
  const { data: auditLogs } = await supabase
    .from('audit_logs')
    .select('*, profiles:actor_id (name)')
    .eq('entity_id', id)
    .order('created_at', { ascending: false })
    .limit(50);

  return (
    <AdminTournamentClient
      tournament={tournament}
      config={config}
      participants={participants ?? []}
      groups={groups ?? []}
      matches={matches ?? []}
      auditLogs={auditLogs ?? []}
      currentUserId={user.id}
    />
  );
}
