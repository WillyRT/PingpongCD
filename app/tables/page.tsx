import { createAdminClient, createClient } from '@/lib/supabase/server';
import { getPlayerSession } from '@/lib/auth/player-session';
import { TablesMonitorClient, type TableMonitorMatch } from '@/components/tables/TablesMonitorClient';
import type { TournamentRow, TournamentGroupRow } from '@/lib/types/database';

interface TablesPageProps {
  searchParams: Promise<{ tournamentId?: string }>;
}

export default async function TablesMonitorPage({ searchParams }: TablesPageProps) {
  const admin = createAdminClient();
  const supabase = await createClient();
  const { tournamentId } = await searchParams;

  // 1. Auth & role check for referee controls
  const { data: { user } } = await supabase.auth.getUser();
  const playerSession = await getPlayerSession();
  const currentEmail = user?.email || playerSession?.email;

  let isRefereeOrAdmin = false;
  if (currentEmail) {
    const cleanEmail = currentEmail.toLowerCase().trim();
    const { data: profile } = await admin
      .from('profiles')
      .select('role, admin_status')
      .eq('email', cleanEmail)
      .maybeSingle();

    isRefereeOrAdmin =
      cleanEmail === 'guillermoriveraterriza@gmail.com' ||
      profile?.role === 'referee' ||
      profile?.role === 'super_admin' ||
      (profile?.role === 'admin' && profile?.admin_status === 'approved') ||
      profile?.role === 'admin';
  }

  // 2. Fetch all tournaments to allow switching
  const { data: allTournaments } = await admin
    .from('tournaments')
    .select('*')
    .order('created_at', { ascending: false });

  const tournamentsList: TournamentRow[] = allTournaments ?? [];

  // 3. Select target tournament: query param > active stage > first available
  let targetTournament: TournamentRow | null = null;

  if (tournamentId) {
    targetTournament = tournamentsList.find((t) => t.id === tournamentId) ?? null;
  }

  if (!targetTournament) {
    targetTournament =
      tournamentsList.find((t) => t.status === 'bracket_stage') ||
      tournamentsList.find((t) => t.status === 'group_stage') ||
      tournamentsList.find((t) => t.status === 'registration') ||
      tournamentsList[0] ||
      null;
  }

  if (!targetTournament) {
    return (
      <TablesMonitorClient
        tournament={null}
        allTournaments={[]}
        groups={[]}
        matches={[]}
        isRefereeOrAdmin={isRefereeOrAdmin}
      />
    );
  }

  // 4. Fetch groups for this tournament
  const { data: groups } = await admin
    .from('tournament_groups')
    .select('*')
    .eq('tournament_id', targetTournament.id)
    .order('group_code', { ascending: true });

  // 5. Fetch matches with joined player details
  const { data: matches } = await admin
    .from('matches')
    .select(
      `*,
      player1:player1_id (id, name, nickname, rating, category),
      player2:player2_id (id, name, nickname, rating, category)`
    )
    .eq('tournament_id', targetTournament.id)
    .order('created_at', { ascending: true });

  return (
    <TablesMonitorClient
      tournament={targetTournament}
      allTournaments={tournamentsList}
      groups={(groups as TournamentGroupRow[]) ?? []}
      matches={(matches as TableMonitorMatch[]) ?? []}
      isRefereeOrAdmin={isRefereeOrAdmin}
    />
  );
}

