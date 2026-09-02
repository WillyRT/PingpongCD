import { createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getHistoricalSeasonSummaries } from '@/lib/data';
import { evaluateUserPermissions } from '@/lib/auth/roles';
import { HistoricalAdminClient } from './HistoricalAdminClient';

export default async function HistoricalSeasonsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login?redirectTo=/admin/historical');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, admin_status')
    .eq('id', user.id)
    .single();

  const { isAdmin } = evaluateUserPermissions(profile, user.email);
  if (!isAdmin) {
    redirect('/player');
  }

  // Fetch db tournaments, players, aliases
  const { data: dbTournaments } = await supabase
    .from('historical_tournaments')
    .select('*')
    .order('year', { ascending: true });

  const { data: dbMatches } = await supabase
    .from('historical_matches')
    .select('*');

  const { data: dbPlayers } = await supabase
    .from('players')
    .select('*, rating_states (*)');

  const { data: dbAliases } = await supabase
    .from('player_aliases')
    .select('*');

  const staticSummaries = getHistoricalSeasonSummaries();

  return (
    <HistoricalAdminClient
      summaries={staticSummaries}
      dbTournaments={dbTournaments ?? []}
      dbMatchesCount={dbMatches?.length ?? 0}
      dbPlayersCount={dbPlayers?.length ?? 0}
      dbAliasesCount={dbAliases?.length ?? 0}
    />
  );
}
