'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createTournamentAction } from '@/lib/actions/tournament';

export default function NewTournamentPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [hiddenStandings, setHiddenStandings] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await createTournamentAction({ name, hiddenStandings });
    if (!res.success) {
      setError(res.error || 'Failed to create tournament');
      setLoading(false);
    } else if (res.data) {
      router.push(`/admin/tournaments/${res.data.id}`);
    }
  };

  return (
    <main className="min-h-screen pb-20">
      {/* Header */}
      <header className="glass sticky top-0 z-50 px-4 py-3 border-b border-[var(--border)]">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href="/admin" className="text-sm font-semibold text-[var(--muted-foreground)] hover:text-white">
            ← Back to Dashboard
          </Link>
          <span className="text-xs font-bold text-[var(--accent)] uppercase">Admin</span>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-4 py-8">
        <div className="p-8 rounded-2xl bg-[var(--card)] border border-[var(--border)] animate-slide-up">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">Create New Tournament</h1>
            <p className="text-sm text-[var(--muted-foreground)] mt-1">
              Set up a table tennis tournament. Participants can join via QR code once registration opens.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-2">
                Tournament Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Torneo Primavera 2026"
                required
                className="w-full px-4 py-3 rounded-xl bg-[var(--secondary)] border border-[var(--border)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:border-[var(--primary)]"
              />
            </div>

            <div className="p-4 rounded-xl bg-[var(--secondary)] border border-[var(--border)] space-y-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hiddenStandings}
                  onChange={(e) => setHiddenStandings(e.target.checked)}
                  className="w-5 h-5 rounded accent-[var(--primary)]"
                />
                <div>
                  <div className="font-medium text-sm">Enable Mystery Mode</div>
                  <div className="text-xs text-[var(--muted-foreground)]">
                    Keep standings hidden from players until all group matches are confirmed.
                  </div>
                </div>
              </label>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-[var(--destructive)]/10 border border-[var(--destructive)]/20 text-[var(--destructive)] text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="w-full py-4 rounded-xl gradient-primary text-white font-semibold text-base disabled:opacity-50 transition hover:scale-[1.01] active:scale-[0.99]"
            >
              {loading ? 'Creating...' : 'Create Tournament'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
