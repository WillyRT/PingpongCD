'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createTournamentAction } from '@/lib/actions/tournament';

export default function NewTournamentPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [tournamentType, setTournamentType] = useState<'official' | 'test'>('official');
  const [hiddenStandings, setHiddenStandings] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await createTournamentAction({
      name,
      hiddenStandings,
      tournamentType,
    });
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
            ← Volver al Panel Admin
          </Link>
          <span className="text-xs font-bold text-[var(--accent)] uppercase">Admin</span>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-4 py-8">
        <div className="p-8 rounded-3xl bg-[var(--card)] border border-[var(--border)] shadow-xl animate-slide-up">
          <div className="mb-6">
            <h1 className="text-2xl font-black text-white">Crear Nuevo Torneo</h1>
            <p className="text-xs text-[var(--muted-foreground)] mt-1">
              Configura un nuevo torneo para Ciudad Ducal. Los jugadores podrán inscribirse mediante enlace o código QR.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* SELECTOR: OFICIAL VS PRUEBAS */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                Modalidad del Torneo
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setTournamentType('official')}
                  className={`p-4 rounded-2xl border text-left transition flex flex-col justify-between gap-2 ${
                    tournamentType === 'official'
                      ? 'bg-amber-500/10 border-amber-500 text-white ring-1 ring-amber-500/50 shadow-md'
                      : 'bg-[var(--secondary)]/50 border-[var(--border)] text-[var(--muted-foreground)] hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">🏆</span>
                    {tournamentType === 'official' && (
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                    )}
                  </div>
                  <div>
                    <div className="font-extrabold text-sm text-white">Torneo Oficial</div>
                    <div className="text-[11px] text-[var(--muted-foreground)] mt-0.5 leading-snug">
                      Puntuable para el Circuito Oficial y Ranking Glicko-2.
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setTournamentType('test')}
                  className={`p-4 rounded-2xl border text-left transition flex flex-col justify-between gap-2 ${
                    tournamentType === 'test'
                      ? 'bg-purple-500/10 border-purple-500 text-white ring-1 ring-purple-500/50 shadow-md'
                      : 'bg-[var(--secondary)]/50 border-[var(--border)] text-[var(--muted-foreground)] hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">🧪</span>
                    {tournamentType === 'test' && (
                      <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
                    )}
                  </div>
                  <div>
                    <div className="font-extrabold text-sm text-white">Torneo de Pruebas</div>
                    <div className="text-[11px] text-[var(--muted-foreground)] mt-0.5 leading-snug">
                      Modo ensayo o exhibición. Se etiquetará con distintivo de pruebas.
                    </div>
                  </div>
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="name" className="block text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)] mb-2">
                Nombre del Torneo
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={tournamentType === 'official' ? 'Ej. Senior CD 2026' : 'Ej. Torneo Pruebas Amistoso'}
                required
                className="w-full px-4 py-3 rounded-xl bg-[var(--secondary)] border border-[var(--border)] text-white placeholder:text-[var(--muted-foreground)] focus:outline-none focus:border-[var(--primary)] text-sm"
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
