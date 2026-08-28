'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { HistoricalSeasonSummary } from '@/lib/data';
import type { HistoricalTournamentRow } from '@/lib/types/database';
import { seedRealHistoricalDataAction } from '@/lib/actions/historical';

interface HistoricalAdminClientProps {
  summaries: HistoricalSeasonSummary[];
  dbTournaments: HistoricalTournamentRow[];
  dbMatchesCount: number;
  dbPlayersCount: number;
  dbAliasesCount: number;
}

export function HistoricalAdminClient({
  summaries,
  dbTournaments,
  dbMatchesCount,
  dbPlayersCount,
  dbAliasesCount,
}: HistoricalAdminClientProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSeedRealData = async () => {
    setLoading(true);
    setMessage(null);
    setError(null);
    const res = await seedRealHistoricalDataAction();
    if (!res.success) {
      setError(res.error || 'Failed to import historical data');
    } else {
      setMessage(`Successfully imported ${res.data?.totalMatches} matches across 2024, 2025, and 2026.`);
    }
    setLoading(false);
  };

  return (
    <main className="min-h-screen pb-20">
      {/* Header */}
      <header className="glass sticky top-0 z-50 px-4 py-3 border-b border-[var(--border)]">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-sm font-semibold text-[var(--muted-foreground)] hover:text-white">
              ← Dashboard
            </Link>
            <span className="text-[var(--border)]">|</span>
            <h1 className="font-bold text-base">Historical Seasons Archive</h1>
          </div>
          <div className="flex gap-2">
            <Link
              href="/admin/historical/identity"
              className="px-3 py-1.5 rounded-lg bg-[var(--secondary)] text-xs font-semibold hover:text-white"
            >
              Identity Resolution
            </Link>
            <Link
              href="/admin/historical/diagnostics"
              className="px-3 py-1.5 rounded-lg bg-[var(--secondary)] text-xs font-semibold hover:text-white"
            >
              Diagnostics
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Banner */}
        <div className="p-6 rounded-2xl bg-[var(--card)] border border-[var(--border)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">Historical Archive (2024–2026)</h2>
            <p className="text-sm text-[var(--muted-foreground)] mt-1 max-w-xl">
              Contains official immutable group-stage results. Longitudinal Glicko-2 ratings are calculated sequentially through chronological replay.
            </p>
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={handleSeedRealData}
            className="w-full md:w-auto px-5 py-3 rounded-xl gradient-primary text-white font-semibold text-xs disabled:opacity-50 transition hover:scale-[1.01]"
          >
            {loading ? 'Importing...' : '⚡ Seed / Replay Real Archive'}
          </button>
        </div>

        {message && (
          <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
            ✓ {message}
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-[var(--destructive)]/10 border border-[var(--destructive)]/20 text-[var(--destructive)] text-sm">
            {error}
          </div>
        )}

        {/* Database Status Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-[var(--card)] border border-[var(--border)] text-center">
            <div className="text-2xl font-bold text-[var(--primary)]">{dbMatchesCount}</div>
            <div className="text-xs text-[var(--muted-foreground)] mt-1">DB Matches</div>
          </div>
          <div className="p-4 rounded-xl bg-[var(--card)] border border-[var(--border)] text-center">
            <div className="text-2xl font-bold">{dbPlayersCount}</div>
            <div className="text-xs text-[var(--muted-foreground)] mt-1">Canonical Players</div>
          </div>
          <div className="p-4 rounded-xl bg-[var(--card)] border border-[var(--border)] text-center">
            <div className="text-2xl font-bold text-[var(--accent)]">{dbAliasesCount}</div>
            <div className="text-xs text-[var(--muted-foreground)] mt-1">Player Aliases</div>
          </div>
          <div className="p-4 rounded-xl bg-[var(--card)] border border-[var(--border)] text-center">
            <div className="text-2xl font-bold">{dbTournaments.length}</div>
            <div className="text-xs text-[var(--muted-foreground)] mt-1">Archived Tournaments</div>
          </div>
        </div>

        {/* Season Cards */}
        <div className="space-y-4">
          <h3 className="font-bold text-lg">Historical Seasons Breakdown</h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {summaries.map((s) => (
              <div
                key={s.season}
                className="p-5 rounded-2xl bg-[var(--card)] border border-[var(--border)] space-y-3 relative overflow-hidden"
              >
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-lg">{s.season}</span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase ${
                      s.isComplete
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-amber-500/20 text-amber-400'
                    }`}
                  >
                    {s.isComplete ? 'Complete' : 'Incomplete'}
                  </span>
                </div>

                <div className="text-xs text-[var(--muted-foreground)] space-y-1">
                  <div className="flex justify-between">
                    <span>Date:</span>
                    <strong className="text-white">{s.date}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Groups:</span>
                    <strong className="text-white">{s.groupCount} Groups</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Players:</span>
                    <strong className="text-white">{s.totalPlayers}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Expected Matches:</span>
                    <strong className="text-white">{s.expectedMatches}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Supplied Matches:</span>
                    <strong className="text-[var(--accent)]">{s.suppliedMatches}</strong>
                  </div>
                  {s.missingMatches > 0 && (
                    <div className="flex justify-between text-amber-400 font-bold">
                      <span>Missing Matches:</span>
                      <span>{s.missingMatches} (Group A)</span>
                    </div>
                  )}
                </div>

                {!s.isComplete && (
                  <div className="pt-2 text-[11px] text-amber-400/90 bg-amber-500/10 p-2 rounded-lg">
                    ⚠️ 1 missing match in Group A (Carlos Ross vs Lucia Marin). Explicitly tracked as incomplete.
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
