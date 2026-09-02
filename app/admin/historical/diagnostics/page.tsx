import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { evaluateUserPermissions } from '@/lib/auth/roles';
import {
  diagnoseHistoricalData,
  type HistoricalTournamentWithMatches,
  type PlayerAlias,
} from '@/lib/engine/historical';

export default async function HistoricalDiagnosticsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login?redirectTo=/admin/historical/diagnostics');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, admin_status')
    .eq('id', user.id)
    .single();

  const { isAdmin } = evaluateUserPermissions(profile, user.email);
  if (!isAdmin) {
    redirect('/player');
  }

  // Fetch actual database records
  const { data: dbTournaments } = await supabase
    .from('historical_tournaments')
    .select('*')
    .order('year', { ascending: true });

  const { data: dbGroups } = await supabase
    .from('historical_groups')
    .select('*');

  const { data: dbMatches } = await supabase
    .from('historical_matches')
    .select('*');

  const { data: dbAliases } = await supabase
    .from('player_aliases')
    .select('*');

  // Format into HistoricalTournamentWithMatches structure
  const tournamentsData: HistoricalTournamentWithMatches[] = (dbTournaments ?? []).map((t) => {
    const groups = (dbGroups ?? []).filter((g) => g.historical_tournament_id === t.id).map((g) => ({
      id: g.id,
      historicalTournamentId: g.historical_tournament_id,
      groupCode: g.group_code,
      expectedMatches: g.expected_matches,
      createdAt: g.created_at,
    }));

    const matches = (dbMatches ?? []).filter((m) => m.historical_tournament_id === t.id).map((m) => ({
      id: m.id,
      historicalTournamentId: m.historical_tournament_id,
      historicalGroupId: m.historical_group_id,
      stage: m.stage,
      player1Id: m.player1_id,
      player2Id: m.player2_id,
      player1SourceName: (m.source_record as any)?.player1Name ?? m.player1_id,
      player2SourceName: (m.source_record as any)?.player2Name ?? m.player2_id,
      scorePlayer1: m.score_player1,
      scorePlayer2: m.score_player2,
      winnerId: m.winner_id,
      status: (m.status as any) ?? (m.score_player1 === 0 && m.score_player2 === 0 ? 'missing' : 'complete'),
      matchDate: m.match_date,
      sourceRecord: m.source_record as any,
      createdAt: m.created_at,
    }));

    return {
      tournament: {
        id: t.id,
        importId: t.import_id,
        name: t.name,
        slug: t.slug,
        year: t.year,
        tournamentDate: t.tournament_date,
        location: t.location,
        createdAt: t.created_at,
      },
      groups,
      matches,
    };
  });

  const aliases: PlayerAlias[] = (dbAliases ?? []).map((a) => ({
    id: a.id,
    playerId: a.player_id,
    alias: a.alias,
    normalizedAlias: a.alias.toLowerCase().trim(),
    sourceSystem: a.source_system,
    confidence: 1.0,
    resolutionStatus: 'confirmed',
    createdAt: a.created_at,
  }));

  const issues = diagnoseHistoricalData(tournamentsData, aliases);

  return (
    <main className="min-h-screen pb-20">
      {/* Header */}
      <header className="glass sticky top-0 z-50 px-4 py-3 border-b border-[var(--border)]">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin/historical" className="text-sm font-semibold text-[var(--muted-foreground)] hover:text-white">
              ← Historical Archive
            </Link>
            <span className="text-[var(--border)]">|</span>
            <h1 className="font-bold text-base">Data Quality Diagnostics</h1>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Banner */}
        <div className="p-6 rounded-2xl bg-[var(--card)] border border-[var(--border)]">
          <h2 className="text-xl font-bold">Historical Archive Diagnostic Audit</h2>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Live health check running across persisted database archives. All anomalies and missing source records are cataloged below.
          </p>
        </div>

        {/* Database Status Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-[var(--card)] border border-[var(--border)] text-center">
            <div className="text-2xl font-bold text-[var(--primary)]">{dbTournaments?.length ?? 0}</div>
            <div className="text-xs text-[var(--muted-foreground)] mt-1">Tournaments in DB</div>
          </div>
          <div className="p-4 rounded-xl bg-[var(--card)] border border-[var(--border)] text-center">
            <div className="text-2xl font-bold">{dbMatches?.length ?? 0}</div>
            <div className="text-xs text-[var(--muted-foreground)] mt-1">Matches in DB</div>
          </div>
          <div className="p-4 rounded-xl bg-[var(--card)] border border-[var(--border)] text-center">
            <div className="text-2xl font-bold text-amber-400">{issues.length}</div>
            <div className="text-xs text-[var(--muted-foreground)] mt-1">Detected Issues</div>
          </div>
        </div>

        {/* Issues list */}
        <div className="space-y-4">
          <h3 className="font-bold text-base">Diagnostic Results ({issues.length})</h3>

          {issues.length === 0 ? (
            <div className="p-8 rounded-2xl bg-[var(--card)] border border-[var(--border)] text-center text-green-400 font-semibold">
              ✓ Data Integrity Verified: No anomalies detected in current database!
            </div>
          ) : (
            <div className="space-y-3">
              {issues.map((issue, idx) => (
                <div
                  key={idx}
                  className={`p-5 rounded-2xl border ${
                    issue.severity === 'error'
                      ? 'bg-red-500/10 border-red-500/30'
                      : 'bg-amber-500/10 border-amber-500/30'
                  } space-y-2`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm uppercase tracking-wider text-amber-400">
                      {issue.type.replace('_', ' ')} • Season {issue.season}
                    </span>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
                      {issue.severity}
                    </span>
                  </div>

                  <p className="text-sm font-medium">{issue.description}</p>
                  <div className="text-xs text-[var(--muted-foreground)] bg-black/20 p-2.5 rounded-xl">
                    <strong>Action / Remedy:</strong> {issue.remedy}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
