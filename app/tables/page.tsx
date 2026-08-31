import { createAdminClient } from '@/lib/supabase/server';
import { TablesMonitorClient, type TableMonitorMatch } from '@/components/tables/TablesMonitorClient';
import type { TournamentRow, TournamentGroupRow } from '@/lib/types/database';

interface TablesPageProps {
  searchParams: Promise<{ tournamentId?: string }>;
}

export default async function TablesMonitorPage({ searchParams }: TablesPageProps) {
  const admin = createAdminClient();
  const { tournamentId } = await searchParams;

  // 1. Fetch all tournaments to allow switching
  const { data: allTournaments } = await admin
    .from('tournaments')
    .select('*')
    .order('created_at', { ascending: false });

  const tournamentsList: TournamentRow[] = allTournaments ?? [];

  // 2. Select target tournament: query param > active stage > first available
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
      />
    );
  }

  // 3. Fetch groups for this tournament
  const { data: groups } = await admin
    .from('tournament_groups')
    .select('*')
    .eq('tournament_id', targetTournament.id)
    .order('group_code', { ascending: true });

  // 4. Fetch matches with joined player material details
  const { data: matches } = await admin
    .from('matches')
    .select(
      `*,
      player1:player1_id (id, name, nickname, rating, category, grip_style, rubber_type),
      player2:player2_id (id, name, nickname, rating, category, grip_style, rubber_type)`
    )
    .eq('tournament_id', targetTournament.id)
    .order('created_at', { ascending: true });

  return (
    <TablesMonitorClient
      tournament={targetTournament}
      allTournaments={tournamentsList}
      groups={(groups as TournamentGroupRow[]) ?? []}
      matches={(matches as TableMonitorMatch[]) ?? []}
    />
  );
}
