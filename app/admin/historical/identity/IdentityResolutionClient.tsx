'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { PlayerRow, PlayerAliasRow } from '@/lib/types/database';
import { resolveIdentityAction } from '@/lib/actions/historical';

interface IdentityResolutionClientProps {
  players: (PlayerRow & { rating_states?: { rating: number }[] })[];
  aliases: PlayerAliasRow[];
}

export function IdentityResolutionClient({ players, aliases }: IdentityResolutionClientProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const playersMap = new Map<string, string>();
  for (const p of players) {
    playersMap.set(p.id, p.canonical_name);
  }

  const handleResolve = async (aliasId: string, targetPlayerId: string, action: 'confirm_merge' | 'keep_separate') => {
    setLoading(true);
    setError(null);
    const res = await resolveIdentityAction({
      aliasId,
      targetPlayerId,
      action,
    });
    if (!res.success) setError(res.error || 'Failed to resolve identity');
    setLoading(false);
  };

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
            <h1 className="font-bold text-base">Player Identity & Alias Resolution</h1>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Banner */}
        <div className="p-6 rounded-2xl bg-[var(--card)] border border-[var(--border)]">
          <h2 className="text-xl font-bold">Canonical Player Identity Registry</h2>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Historical records retain immutable source strings. This registry maps variations and aliases to canonical player identities so ratings aggregate accurately.
          </p>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-[var(--destructive)]/10 border border-[var(--destructive)]/20 text-[var(--destructive)] text-sm">
            {error}
          </div>
        )}

        {/* Canonical Players Table */}
        <div className="p-6 rounded-2xl bg-[var(--card)] border border-[var(--border)] space-y-4">
          <h3 className="font-bold text-base">Canonical Players ({players.length})</h3>
          <div className="divide-y divide-[var(--border)] max-h-96 overflow-y-auto">
            {players.map((p) => {
              const rating = p.rating_states?.[0]?.rating ?? 1500;
              const playerAliases = aliases.filter((a) => a.player_id === p.id);

              return (
                <div key={p.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-sm">{p.canonical_name}</div>
                    <div className="text-xs text-[var(--muted-foreground)] flex items-center gap-2 mt-0.5">
                      <span>Rating: <strong className="text-white">{rating.toFixed(0)}</strong></span>
                      <span>•</span>
                      <span>Aliases: {playerAliases.map((a) => a.alias).join(', ') || 'None'}</span>
                    </div>
                  </div>
                  <span className="text-xs font-mono text-[var(--muted-foreground)]">
                    {p.id.slice(0, 10)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Aliases Table */}
        <div className="p-6 rounded-2xl bg-[var(--card)] border border-[var(--border)] space-y-4">
          <h3 className="font-bold text-base">Resolved Aliases ({aliases.length})</h3>
          <div className="divide-y divide-[var(--border)]">
            {aliases.map((a) => {
              const canonicalName = playersMap.get(a.player_id) || 'Unknown';

              return (
                <div key={a.id} className="py-3 flex items-center justify-between">
                  <div>
                    <span className="font-mono font-medium text-sm text-[var(--primary)]">
                      "{a.alias}"
                    </span>
                    <span className="text-xs text-[var(--muted-foreground)] ml-2">
                      → Maps to <strong className="text-white">{canonicalName}</strong>
                    </span>
                  </div>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-green-500/20 text-green-400 font-semibold">
                    Confirmed
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}
