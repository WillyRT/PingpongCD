import { createAdminClient } from '@/lib/supabase/server';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

interface HistoricalTournamentItem {
  id: string;
  name: string;
  slug: string;
  year: number;
  category: string;
  participantCount: number;
  matchCount: number;
  groupCount: number;
}

export default async function HistoricoPage() {
  const admin = createAdminClient();

  // Fetch all finished tournaments
  const { data: tournaments } = await admin
    .from('tournaments')
    .select('*')
    .eq('status', 'finished')
    .order('created_at', { ascending: false });

  // Fetch participant counts
  const { data: participants } = await admin
    .from('tournament_participants')
    .select('tournament_id');

  // Fetch match counts
  const { data: matches } = await admin
    .from('matches')
    .select('tournament_id');

  // Fetch groups
  const { data: groups } = await admin
    .from('tournament_groups')
    .select('tournament_id');

  const tourneyList = tournaments || [];

  // Group by year
  const tournamentsWithStats: HistoricalTournamentItem[] = tourneyList.map((t) => {
    const yearMatch = t.name.match(/\b(20\d\d)\b/);
    const year = yearMatch ? parseInt(yearMatch[1]!) : new Date(t.created_at).getFullYear();
    const isSub = t.name.toLowerCase().includes('sub');
    const category = isSub ? 'Sub-14 / Sub-16' : 'Senior (+14)';

    const pCount = (participants || []).filter((p) => p.tournament_id === t.id).length;
    const mCount = (matches || []).filter((m) => m.tournament_id === t.id).length;
    const gCount = (groups || []).filter((g) => g.tournament_id === t.id).length;

    return {
      id: t.id,
      name: t.name,
      slug: t.slug,
      year,
      category,
      participantCount: pCount,
      matchCount: mCount,
      groupCount: gCount,
    };
  });

  // Unique years sorted descending
  const years = Array.from(new Set(tournamentsWithStats.map((t) => t.year))).sort((a, b) => b - a);

  // Global totals
  const totalTournaments = tournamentsWithStats.length;
  const totalMatches = tournamentsWithStats.reduce((acc, t) => acc + t.matchCount, 0);
  const totalParticipations = tournamentsWithStats.reduce((acc, t) => acc + t.participantCount, 0);

  return (
    <main className="min-h-screen max-w-6xl mx-auto px-4 py-8 md:py-12 space-y-10 animate-slide-up">
      {/* Header */}
      <div className="p-6 md:p-10 rounded-3xl bg-[var(--card)] border border-[var(--border)] shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-4xl md:text-5xl shadow-xl shrink-0 border border-amber-500/30">
              📜
            </div>
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border text-amber-400 bg-amber-500/10 border-amber-500/30 mb-2">
                <span>🏛️</span>
                <span>Archivo Histórico Oficial (2023–2026)</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">
                Histórico de Torneos Ciudad Ducal
              </h1>
              <p className="text-xs text-[var(--muted-foreground)] mt-1 max-w-xl">
                Registro oficial auditado de todas las ediciones del campeonato. Consulta cuadros finales, clasificaciones de grupos y las actas partido a partido.
              </p>
            </div>
          </div>

          {/* Quick Stat Badges */}
          <div className="grid grid-cols-3 gap-3 shrink-0 bg-[var(--secondary)]/60 p-3.5 rounded-2xl border border-[var(--border)]">
            <div className="text-center px-2">
              <div className="text-xl md:text-2xl font-black text-white">{totalTournaments}</div>
              <div className="text-[10px] uppercase font-bold text-[var(--muted-foreground)] tracking-wider">
                Ediciones
              </div>
            </div>
            <div className="text-center px-2 border-x border-[var(--border)]">
              <div className="text-xl md:text-2xl font-black text-amber-400">{totalMatches}</div>
              <div className="text-[10px] uppercase font-bold text-[var(--muted-foreground)] tracking-wider">
                Partidos
              </div>
            </div>
            <div className="text-center px-2">
              <div className="text-xl md:text-2xl font-black text-green-400">{totalParticipations}</div>
              <div className="text-[10px] uppercase font-bold text-[var(--muted-foreground)] tracking-wider">
                Participaciones
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tournaments grouped by year */}
      <div className="space-y-12">
        {years.map((year) => {
          const yearTournaments = tournamentsWithStats.filter((t) => t.year === year);

          return (
            <section key={year} className="space-y-4">
              <div className="flex items-center gap-3 border-b border-[var(--border)] pb-3">
                <span className="px-3.5 py-1 rounded-xl bg-amber-500/20 text-amber-400 font-mono font-black text-lg border border-amber-500/30">
                  {year}
                </span>
                <div>
                  <h2 className="text-xl font-black text-white">Temporada {year}</h2>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {yearTournaments.length} torneos disputados en Ciudad Ducal
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {yearTournaments.map((t) => (
                  <div
                    key={t.id}
                    className="p-6 rounded-3xl bg-[var(--card)] border border-[var(--border)] shadow-lg hover:border-amber-500/50 transition-all flex flex-col justify-between gap-5 group"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[var(--secondary)] text-white border border-[var(--border)]">
                          {t.category}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/30">
                          ✓ Finalizado
                        </span>
                      </div>

                      <h3 className="text-xl font-black text-white group-hover:text-amber-400 transition">
                        {t.name}
                      </h3>

                      <div className="flex items-center gap-4 text-xs text-[var(--muted-foreground)]">
                        <span>👥 <strong>{t.participantCount}</strong> Jugadores</span>
                        <span>•</span>
                        <span>🏓 <strong>{t.matchCount}</strong> Partidos</span>
                        <span>•</span>
                        <span>📊 <strong>{t.groupCount}</strong> Grupos</span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-[var(--border)] flex items-center gap-3">
                      <Link
                        href={`/t/${t.slug}`}
                        className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs text-center shadow transition"
                      >
                        Ver Clasificaciones y Actas →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
