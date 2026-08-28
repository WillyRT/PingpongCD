import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function PlayerDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const cookieStore = await cookies();
  const cookiePlayerId = cookieStore.get('tourneymaster_player_id')?.value;

  const targetPlayerId = user?.id || cookiePlayerId;
  if (!targetPlayerId) redirect('/login');

  // Fetch player profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .or(`id.eq.${targetPlayerId},user_id.eq.${targetPlayerId}`)
    .maybeSingle();

  if (!profile) redirect('/login');

  // Fetch player's tournament participations
  const { data: participations } = await supabase
    .from('tournament_participants')
    .select(`
      *,
      tournaments:tournament_id (*)
    `)
    .eq('user_id', profile.id);

  // Fetch player's pending/submitted matches
  const { data: activeMatches } = await supabase
    .from('matches')
    .select('*, player1:player1_id (id, name), player2:player2_id (id, name)')
    .or(`player1_id.eq.${profile.id},player2_id.eq.${profile.id}`)
    .in('status', ['pending', 'submitted'])
    .order('created_at', { ascending: true })
    .limit(5);

  // Query canonical player associated with this user (if claimed/linked) or matching name
  let canonicalPlayerId: string | null = null;
  if (profile) {
    const { data: linkedPlayer } = await supabase
      .from('players')
      .select('id')
      .or(`user_id.eq.${profile.id},canonical_name.ilike.${profile.name}`)
      .limit(1)
      .maybeSingle();

    if (linkedPlayer) canonicalPlayerId = linkedPlayer.id;
  }

  // Fetch rating snapshots from Supabase for this player
  interface RatingSnapshotView {
    season: number;
    ratingAfter: number;
    rdAfter: number;
    matchesInPeriod: number;
  }

  const snapshots: RatingSnapshotView[] = [];

  if (canonicalPlayerId) {
    const { data: dbSnapshots } = await supabase
      .from('rating_snapshots')
      .select('*, historical_tournaments:rating_period_id (year)')
      .eq('player_id', canonicalPlayerId)
      .order('calculated_at', { ascending: true });

    if (dbSnapshots) {
      for (const s of dbSnapshots) {
        const year = (s.historical_tournaments as any)?.year ?? 2024;
        snapshots.push({
          season: year,
          ratingAfter: s.rating_after,
          rdAfter: s.rd_after,
          matchesInPeriod: s.matches_in_period,
        });
      }
    }
  }

  return (
    <main className="min-h-screen pb-20">
      {/* Header */}
      <header className="glass sticky top-0 z-50 px-4 py-3 border-b border-[var(--border)]">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href="/" className="font-bold text-lg">
            Tourney<span className="text-[var(--primary)]">Master</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/leaderboard"
              className="text-xs font-semibold text-[var(--muted-foreground)] hover:text-white"
            >
              🏆 Leaderboard
            </Link>
            <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-white text-sm font-bold">
              {profile?.name?.charAt(0)?.toUpperCase() ?? '?'}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Stats Card */}
        <div className="p-6 rounded-2xl bg-[var(--card)] border border-[var(--border)] space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-extrabold">{profile?.name ?? 'Player'}</h1>
              <div className="text-xs text-[var(--muted-foreground)]">
                {profile?.role === 'admin' ? 'Administrator' : 'Table Tennis Competitor'}
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 text-xs font-semibold">
              Glicko-2
            </span>
          </div>

          <div className="grid grid-cols-3 gap-4 text-center pt-2 border-t border-[var(--border)]">
            <div>
              <div className="text-2xl font-extrabold text-[var(--primary)]">
                {profile?.rating?.toFixed(0) ?? '1500'}
              </div>
              <div className="text-xs text-[var(--muted-foreground)] mt-1">Rating</div>
            </div>
            <div>
              <div className="text-2xl font-bold">
                {profile?.matches_played ?? 0}
              </div>
              <div className="text-xs text-[var(--muted-foreground)] mt-1">Matches</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-[var(--accent)]">
                {participations?.length ?? 0}
              </div>
              <div className="text-xs text-[var(--muted-foreground)] mt-1">
                Tournaments
              </div>
            </div>
          </div>
        </div>

        {/* Rating Progression Timeline */}
        {snapshots.length > 0 && (
          <div className="p-6 rounded-2xl bg-[var(--card)] border border-[var(--border)] space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
              HISTORICAL RATING PROGRESSION
            </h2>

            {/* Progression Bar */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--secondary)]">
              {snapshots.map((p, idx) => (
                <div key={idx} className="text-center flex-1">
                  <div className="text-xs text-[var(--muted-foreground)] font-semibold">
                    {p.season}
                  </div>
                  <div className="text-lg font-mono font-extrabold text-[var(--primary)]">
                    {p.ratingAfter.toFixed(0)}
                  </div>
                  {idx < snapshots.length - 1 && (
                    <div className="text-[10px] text-[var(--muted-foreground)]">→</div>
                  )}
                </div>
              ))}
            </div>

            {/* Season Stats Breakdown */}
            <div className="divide-y divide-[var(--border)] text-xs">
              {snapshots.map((s, idx) => (
                <div key={idx} className="py-3 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-sm text-white">Season {s.season}</span>
                    <div className="text-[var(--muted-foreground)] mt-0.5">
                      {s.matchesInPeriod} matches • Uncertainty: ±{s.rdAfter.toFixed(0)}
                    </div>
                  </div>
                  <span className="font-mono font-bold text-[var(--accent)] text-sm">
                    {s.ratingAfter.toFixed(0)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active Matches */}
        {activeMatches && activeMatches.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
              PENDING MATCHES
            </h2>
            <div className="space-y-3">
              {activeMatches.map((match) => (
                <div
                  key={match.id}
                  className="p-4 rounded-xl bg-[var(--card)] border border-[var(--border)] flex items-center justify-between"
                >
                  <div>
                    <div className="font-medium text-sm">
                      {match.status === 'pending' ? '⏳ Ready to Play' : '📤 Score Submitted'}
                    </div>
                    <div className="text-xs text-[var(--muted-foreground)] capitalize">
                      {match.stage} stage
                    </div>
                  </div>
                  {match.status === 'pending' && (
                    <Link
                      href={`/player/report/${match.id}`}
                      className="px-4 py-2 rounded-lg gradient-primary text-white text-xs font-semibold"
                    >
                      Report Score
                    </Link>
                  )}
                  {match.status === 'submitted' && match.reported_by !== profile.id && (
                    <Link
                      href={`/player/report/${match.id}`}
                      className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-xs font-semibold"
                    >
                      Confirm
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tournaments */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
            LIVE TOURNAMENTS
          </h2>
          {(!participations || participations.length === 0) ? (
            <div className="p-8 rounded-2xl bg-[var(--card)] border border-[var(--border)] text-center space-y-2">
              <div className="text-3xl">🏓</div>
              <p className="text-sm font-semibold">No live tournament joined yet</p>
              <p className="text-xs text-[var(--muted-foreground)]">
                Scan a tournament QR code or ask the admin for the link to join.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {participations.map((p: Record<string, unknown>) => {
                const t = p.tournaments as Record<string, unknown> | null;
                return (
                  <Link
                    key={String(p.tournament_id)}
                    href={`/t/${t?.slug ?? ''}`}
                    className="block p-4 rounded-xl bg-[var(--card)] border border-[var(--border)] hover:border-[var(--primary)] transition-colors"
                  >
                    <div className="font-bold text-sm">{String(t?.name ?? 'Tournament')}</div>
                    <div className="text-xs text-[var(--muted-foreground)] mt-1 capitalize">
                      Phase: {String(t?.status ?? 'unknown').replace('_', ' ')}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
