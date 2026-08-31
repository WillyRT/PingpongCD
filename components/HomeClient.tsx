'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { TournamentRow } from '@/lib/types/database';

interface HomeClientProps {
  initialTournaments: TournamentRow[];
  isAdmin?: boolean;
}

export function HomeClient({ initialTournaments, isAdmin = false }: HomeClientProps) {
  const statusLabels: Record<string, { label: string; color: string }> = {
    draft: { label: 'Borrador', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
    registration: { label: 'Inscripciones Abiertas', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
    registration_open: { label: 'Inscripciones Abiertas', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
    group_stage: { label: 'Fase de Grupos en Vivo', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    bracket_stage: { label: 'Playoffs / Cuadro Final', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
    in_progress: { label: 'En Juego', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    live: { label: 'En Directo', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    finished: { label: 'Finalizado', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  };

  return (
    <div className="space-y-12">
      {/* Prominent Action Cards */}
      <section className={`grid gap-6 ${isAdmin ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4' : 'grid-cols-1 md:grid-cols-3'}`}>
        {/* ACTION 1: VER TORNEOS ACTIVOS */}
        <div className="rounded-2xl bg-[var(--card)] border border-[var(--border)] p-6 flex flex-col justify-between shadow-lg hover:border-[var(--primary)]/50 transition-all group">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center text-2xl shadow-md group-hover:scale-105 transition-transform">
              🏆
            </div>
            <h2 className="text-xl font-black">Torneo Activo</h2>
            <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
              Consulta los cuadros oficiales, fases de grupos en vivo y actas de las mesas de juego.
            </p>
          </div>

          <div className="pt-6">
            <a
              href="#torneos-activos"
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow transition flex items-center justify-center gap-2"
            >
              <span>Ver Competición en Curso</span>
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
            <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-2xl shadow-md group-hover:scale-105 transition-transform">
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
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow transition flex items-center justify-center gap-2"
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

      {/* Active Tournaments Section */}
      <section id="torneos-activos" className="space-y-4 pt-4 scroll-mt-20">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black text-[var(--foreground)]">🏆 Torneos en Curso</h2>
            <p className="text-xs text-[var(--muted-foreground)]">
              Competiciones activas del Circuito Ciudad Ducal con actas y marcadores oficiales.
            </p>
          </div>
          <Link
            href="/historico"
            className="text-xs font-bold text-blue-500 hover:underline flex items-center gap-1 shrink-0"
          >
            <span>Ver Histórico de Ediciones Anteriores</span>
            <span>→</span>
          </Link>
        </div>

        {initialTournaments.length === 0 ? (
          <div className="p-8 sm:p-12 rounded-3xl bg-[var(--card)] border-2 border-[var(--border)] text-center space-y-4 shadow-md max-w-xl mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center text-4xl mx-auto border border-amber-500/20">
              🏓
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-black text-[var(--foreground)]">No hay torneos en curso</h3>
              <p className="text-xs sm:text-sm text-[var(--muted-foreground)] leading-relaxed">
                Las inscripciones para la próxima edición se abrirán próximamente.
              </p>
            </div>
            <div className="pt-2">
              <Link
                href="/historico"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow transition"
              >
                <span>Ver palmarés y ediciones anteriores en el Histórico →</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {initialTournaments.map((t) => {
              const st = statusLabels[t.status] || { label: t.status, color: 'bg-gray-500/20 text-gray-300 border-gray-500/30' };
              const isOpen = t.status === 'registration' || (t.status as string) === 'registration_open' || t.status === 'draft';
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

                    <h3 className="font-extrabold text-base text-[var(--foreground)]">{t.name}</h3>
                    <p className="text-xs text-[var(--muted-foreground)] font-mono">
                      /t/{t.slug}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-[var(--border)]">
                    {isOpen ? (
                      <Link
                        href={`/join/${t.id}`}
                        className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold text-center shadow transition"
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
