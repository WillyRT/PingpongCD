import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

export default async function HistoricalLeaderboardPage() {
  const supabase = await createClient();

  // Query canonical ratings and players from Supabase
  const { data: ratingStates } = await supabase
    .from('rating_states')
    .select('*, players:player_id (id, canonical_name)')
    .order('rating', { ascending: false });

  // Query completed historical matches to compute record stats
  const { data: historicalMatches } = await supabase
    .from('historical_matches')
    .select('*, historical_tournaments:historical_tournament_id (year)')
    .eq('status', 'complete');

  interface LeaderboardItem {
    id: string;
    name: string;
    rating: number;
    rd: number;
    matchesPlayed: number;
    wins: number;
    losses: number;
    winRate: number;
    diff: number;
    seasonsCount: number;
  }

  const leaderboardEntries: LeaderboardItem[] = [];

  if (ratingStates && ratingStates.length > 0) {
    for (const rs of ratingStates) {
      const p = rs.players as { id: string; canonical_name: string } | null;
      if (!p) continue;

      let wins = 0;
      let losses = 0;
      let pf = 0;
      let pa = 0;
      const seasonsSet = new Set<number>();

      if (historicalMatches) {
        for (const m of historicalMatches) {
          if (m.player1_id === p.id || m.player2_id === p.id) {
            const year = (m.historical_tournaments as any)?.year;
            if (year) seasonsSet.add(year);

            const isP1 = m.player1_id === p.id;
            pf += isP1 ? m.score_player1 : m.score_player2;
            pa += isP1 ? m.score_player2 : m.score_player1;

            if (m.winner_id === p.id) wins++;
            else losses++;
          }
        }
      }

      const total = wins + losses || rs.matches_played;
      const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;

      leaderboardEntries.push({
        id: p.id,
        name: p.canonical_name,
        rating: rs.rating,
        rd: rs.rating_deviation,
        matchesPlayed: total,
        wins,
        losses,
        winRate,
        diff: pf - pa,
        seasonsCount: seasonsSet.size,
      });
    }
  }

  return (
    <main className="min-h-screen pb-20">
      {/* Header */}
      <header className="glass sticky top-0 z-50 px-4 py-3 border-b border-[var(--border)]">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="font-extrabold text-lg">
            Tourney<span className="text-[var(--primary)]">Master</span>
          </Link>
          <div className="flex gap-2">
            <Link href="/player" className="px-3 py-1.5 rounded-lg bg-[var(--secondary)] text-xs font-semibold hover:text-white">
              Player Dashboard
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold">Historical Rating Leaderboard</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Global Glicko-2 ratings calculated from the official database archive (2024–2026).
          </p>
        </div>

        {leaderboardEntries.length === 0 ? (
          <div className="p-12 rounded-2xl bg-[var(--card)] border border-[var(--border)] text-center space-y-3">
            <div className="text-4xl">🏓</div>
            <h3 className="font-bold text-lg">No rating data in database yet</h3>
            <p className="text-xs text-[var(--muted-foreground)] max-w-sm mx-auto">
              Historical match archive has not yet been seeded into Supabase. Administrators can seed and replay the archive from the Admin panel.
            </p>
            <Link
              href="/admin/historical"
              className="inline-block px-4 py-2 rounded-xl gradient-primary text-white text-xs font-semibold"
            >
              Go to Historical Management
            </Link>
          </div>
        ) : (
          /* Leaderboard Table */
          <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--card)]">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-[var(--secondary)] text-[var(--muted-foreground)]">
                <tr>
                  <th className="px-3 py-3 text-center w-8">#</th>
                  <th className="px-4 py-3">Player</th>
                  <th className="px-3 py-3 text-center font-bold text-[var(--primary)]">Glicko-2</th>
                  <th className="px-2 py-3 text-center text-xs text-[var(--muted-foreground)]">±RD</th>
                  <th className="px-2 py-3 text-center">PJ</th>
                  <th className="px-2 py-3 text-center font-bold text-[var(--accent)]">PG</th>
                  <th className="px-2 py-3 text-center text-red-400">PP</th>
                  <th className="px-2 py-3 text-center">Win %</th>
                  <th className="px-3 py-3 text-center font-semibold">Diff</th>
                  <th className="px-3 py-3 text-center">Seasons</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {leaderboardEntries.map((entry, idx) => (
                  <tr
                    key={entry.id}
                    className={`hover:bg-[var(--secondary)]/50 transition-colors ${
                      idx < 3 ? 'bg-amber-500/[0.03]' : ''
                    }`}
                  >
                    <td className="px-3 py-3 text-center font-bold text-xs">
                      <span
                        className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${
                          idx === 0
                            ? 'bg-amber-500/20 text-amber-400'
                            : idx === 1
                            ? 'bg-slate-400/20 text-slate-300'
                            : idx === 2
                            ? 'bg-amber-700/20 text-amber-600'
                            : 'text-[var(--muted-foreground)]'
                        }`}
                      >
                        {idx + 1}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      <Link
                        href={`/player/${entry.id}`}
                        className="hover:text-[var(--primary)] hover:underline transition font-bold text-white"
                      >
                        {entry.name}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-center font-mono font-extrabold text-[var(--primary)]">
                      {entry.rating.toFixed(0)}
                    </td>
                    <td className="px-2 py-3 text-center font-mono text-[11px] text-[var(--muted-foreground)]">
                      ±{entry.rd.toFixed(0)}
                    </td>
                    <td className="px-2 py-3 text-center">{entry.matchesPlayed}</td>
                    <td className="px-2 py-3 text-center font-bold text-[var(--accent)]">{entry.wins}</td>
                    <td className="px-2 py-3 text-center text-red-400">{entry.losses}</td>
                    <td className="px-2 py-3 text-center font-mono font-semibold">{entry.winRate}%</td>
                    <td className="px-3 py-3 text-center font-mono font-semibold">
                      {entry.diff > 0 ? `+${entry.diff}` : entry.diff}
                    </td>
                    <td className="px-3 py-3 text-center font-semibold text-xs text-[var(--muted-foreground)]">
                      {entry.seasonsCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
