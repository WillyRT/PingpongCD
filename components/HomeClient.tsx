'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { TournamentRow } from '@/lib/types/database';

interface HomeClientProps {
  initialTournaments: TournamentRow[];
  isAdmin?: boolean;
}

export function HomeClient({ initialTournaments, isAdmin = false }: HomeClientProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'finished'>('all');

  const filteredTournaments = initialTournaments.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.slug.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === 'active') {
      return t.status !== 'finished';
    }
    if (statusFilter === 'finished') {
      return t.status === 'finished';
    }
    return true;
  });

  const statusLabels: Record<string, { label: string; color: string }> = {
    draft: { label: 'Borrador', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
    registration: { label: 'Inscripciones Abiertas', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
    group_stage: { label: 'Fase de Grupos en Vivo', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    bracket_stage: { label: 'Playoffs / Cuadro Final', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
    finished: { label: 'Finalizado', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  };

  return (
    <div className="space-y-12">
      {/* Prominent Action Cards */}
      <section className={`grid gap-6 ${isAdmin ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4' : 'grid-cols-1 md:grid-cols-3'}`}>
        {/* ACTION 1: VER TORNEOS ACTIVOS */}
        <div className="rounded-2xl bg-[var(--card)] border border-[var(--border)] p-6 flex flex-col justify-between shadow-lg hover:border-[var(--primary)]/50 transition-all group">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl gradient-primary text-white flex items-center justify-center text-2xl shadow-md group-hover:scale-105 transition-transform">
              🏆
            </div>
            <h2 className="text-xl font-black">Ver Torneos Activos</h2>
            <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
              Consulta los cuadros oficiales, fases de grupos en vivo y actas de todas las ediciones del circuito.
            </p>
          </div>

          <div className="pt-6">
            <a
              href="#torneos-circuito"
              className="w-full py-3 rounded-xl gradient-primary text-white text-xs font-bold shadow transition flex items-center justify-center gap-2 hover:opacity-95"
            >
              <span>Explorar Torneos</span>
              <span>↓</span>
            </a>
          </div>
        </div>

        {/* ACTION 2: RANKING OFICIAL */}
        <div className="rounded-2xl bg-[var(--card)] border border-[var(--border)] p-6 flex flex-col justify-between shadow-lg hover:border-amber-500/50 transition-all group">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-amber-600 text-white flex items-center justify-center text-2xl shadow-md group-hover:scale-105 transition-transform">
              📊
            </div>
            <h2 className="text-xl font-black">Ranking Oficial (Glicko-2)</h2>
            <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
              Clasificación general actualizada con algoritmo Glicko-2, ratios de victoria y estadísticas de cantera y senior.
            </p>
          </div>

          <div className="pt-6">
            <Link
              href="/leaderboard"
              className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow transition flex items-center justify-center gap-2"
            >
              <span>Ver Ranking Oficial</span>
              <span>→</span>
            </Link>
          </div>
        </div>

        {/* ACTION 3: MI PORTAL DE JUGADOR */}
        <div className="rounded-2xl bg-[var(--card)] border border-[var(--border)] p-6 flex flex-col justify-between shadow-lg hover:border-blue-500/50 transition-all group">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center text-2xl shadow-md group-hover:scale-105 transition-transform">
              👤
            </div>
            <h2 className="text-xl font-black">Mi Portal de Jugador</h2>
            <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
              Acceso para jugadores. Consulta tu ELO individual, próximos partidos asignados, mesa de juego y valida resultados.
            </p>
          </div>

          <div className="pt-6">
            <Link
              href="/me"
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow transition flex items-center justify-center gap-2"
            >
              <span>Acceder a Mi Portal</span>
              <span>→</span>
            </Link>
          </div>
        </div>

        {/* ACTION 4: CREAR TORNEO (SOLO ADMINS) */}
        {isAdmin && (
          <div className="rounded-2xl bg-[var(--card)] border border-purple-500/40 p-6 flex flex-col justify-between shadow-lg hover:border-purple-500 transition-all group bg-gradient-to-br from-purple-500/5 via-transparent to-transparent">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-purple-600 text-white flex items-center justify-center text-2xl shadow-md group-hover:scale-105 transition-transform">
                ⚙️
              </div>
              <h2 className="text-xl font-black text-purple-300">Crear Torneo</h2>
              <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                Herramienta exclusiva para administradores. Genera grupos equilibrados por ELO y cuadros eliminatorios en 1 clic.
              </p>
            </div>

            <div className="pt-6">
              <Link
                href="/admin/tournaments/new"
                className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow transition flex items-center justify-center gap-2"
              >
                <span>Crear Nuevo Torneo</span>
                <span>+</span>
              </Link>
            </div>
          </div>
        )}
      </section>

      {/* Active Tournaments Showcase */}
      <section id="torneos-circuito" className="space-y-4 pt-4 scroll-mt-20">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black">🏆 Torneos del Circuito</h2>
            <p className="text-xs text-[var(--muted-foreground)]">
              Torneos oficiales con seguimiento en tiempo real y acta electrónica.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            {/* Filter buttons */}
            <div className="flex items-center rounded-xl bg-[var(--secondary)] p-1 border border-[var(--border)] text-xs font-semibold">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  statusFilter === 'all' ? 'bg-[var(--primary)] text-white shadow' : 'text-[var(--muted-foreground)] hover:text-white'
                }`}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('active')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  statusFilter === 'active' ? 'bg-[var(--primary)] text-white shadow' : 'text-[var(--muted-foreground)] hover:text-white'
                }`}
              >
                En Curso
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('finished')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  statusFilter === 'finished' ? 'bg-[var(--primary)] text-white shadow' : 'text-[var(--muted-foreground)] hover:text-white'
                }`}
              >
                Finalizados
              </button>
            </div>

            <div className="w-full sm:w-48">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="🔍 Buscar..."
                className="w-full px-3.5 py-1.5 rounded-xl bg-[var(--secondary)] border border-[var(--border)] text-xs focus:outline-none focus:border-[var(--primary)]"
              />
            </div>
          </div>
        </div>

        {/* Historical Archive Banner */}
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-amber-300">
            <span>📜</span>
            <span>¿Buscas las clasificaciones y partidos de 2023, 2024, 2025 o 2026?</span>
          </div>
          <Link
            href="/historico"
            className="text-xs font-bold text-amber-400 hover:text-amber-300 hover:underline shrink-0 flex items-center gap-1"
          >
            <span>Ver Archivo Histórico Completo</span>
            <span>→</span>
          </Link>
        </div>

        {filteredTournaments.length === 0 ? (
          <div className="p-8 rounded-2xl bg-[var(--card)] border border-[var(--border)] text-center text-xs text-[var(--muted-foreground)]">
            No se encontraron torneos con el criterio de búsqueda.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredTournaments.map((t) => {
              const st = statusLabels[t.status] || { label: t.status, color: 'bg-gray-500/20 text-gray-300 border-gray-500/30' };
              const isOpen = t.status === 'registration' || t.status === 'draft';
              const isTest = t.name.toLowerCase().includes('prueba') || t.slug.toLowerCase().includes('test');

              return (
                <div
                  key={t.id}
                  className="p-5 rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-sm hover:border-[var(--border)]/80 flex flex-col justify-between gap-4 transition-all"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${st.color}`}>
                          {st.label}
                        </span>
                        {isTest && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-purple-500/20 text-purple-300 border-purple-500/30">
                            🧪 Pruebas
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-[var(--muted-foreground)] font-mono">
                        {new Date(t.created_at).toLocaleDateString('es-ES')}
                      </span>
                    </div>

                    <h3 className="font-extrabold text-base text-white">{t.name}</h3>
                    <p className="text-xs text-[var(--muted-foreground)] font-mono">
                      /t/{t.slug}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-[var(--border)]">
                    {isOpen ? (
                      <Link
                        href={`/join/${t.id}`}
                        className="flex-1 py-2 rounded-xl gradient-primary text-white text-xs font-bold text-center shadow hover:opacity-90 transition"
                      >
                        Inscribirme
                      </Link>
                    ) : (
                      <Link
                        href={`/t/${t.slug}`}
                        className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold text-center shadow transition"
                      >
                        Ver Cuadro en Vivo
                      </Link>
                    )}
                    <Link
                      href={`/t/${t.slug}`}
                      className="px-3.5 py-2 rounded-xl bg-[var(--secondary)] hover:bg-[var(--secondary)]/80 text-xs font-semibold transition"
                    >
                      Detalles
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
