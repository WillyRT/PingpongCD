'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { TournamentRow } from '@/lib/types/database';

interface HomeClientProps {
  initialTournaments: TournamentRow[];
}

export function HomeClient({ initialTournaments }: HomeClientProps) {
  const [search, setSearch] = useState('');
  const [joinCode, setJoinCode] = useState('');

  const filteredTournaments = initialTournaments.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.slug.toLowerCase().includes(search.toLowerCase())
  );

  const statusLabels: Record<string, { label: string; color: string }> = {
    draft: { label: 'Borrador', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
    registration: { label: 'Inscripciones Abiertas', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
    group_stage: { label: 'Fase de Grupos en Vivo', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    bracket_stage: { label: 'Playoffs / Cuadro Final', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
    finished: { label: 'Finalizado', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  };

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="text-center space-y-4 pt-6">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--card)] border border-[var(--border)] text-xs font-bold shadow-sm">
          <span className="text-base">🏓</span>
          <span>Circuito Oficial de Tenis de Mesa TourneyMaster AI</span>
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        </div>

        <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-none">
          Compite. Mide tu <span className="text-[var(--primary)]">ELO</span>.<br />
          Domina la <span className="text-[var(--accent)]">Mesa</span>.
        </h1>

        <p className="text-sm sm:text-base text-[var(--muted-foreground)] max-w-2xl mx-auto leading-relaxed">
          Plataforma integral con desempate Glicko-2 en vivo, analítica predictiva Bradley-Terry,
          doble validación de actas y consola de árbitro para 4 mesas simultáneas.
        </p>
      </section>

      {/* 3 Prominent Action Cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* ACTION 1: SEARCH / JOIN TOURNAMENT */}
        <div className="rounded-2xl bg-[var(--card)] border border-[var(--border)] p-6 flex flex-col justify-between shadow-lg hover:border-[var(--primary)]/50 transition-all group">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl gradient-primary text-white flex items-center justify-center text-2xl shadow-md group-hover:scale-105 transition-transform">
              🔍
            </div>
            <h2 className="text-xl font-black">Buscar / Unirse a un Torneo</h2>
            <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
              Introduce el enlace, código o slug del torneo para completar tu inscripción pública en menos de 1 minuto.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (joinCode.trim()) {
                  window.location.href = `/join/${encodeURIComponent(joinCode.trim())}`;
                }
              }}
              className="pt-2 space-y-2"
            >
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="Slug o ID (ej: prueba-ping-pong)"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--secondary)] border border-[var(--border)] text-xs focus:outline-none focus:border-[var(--primary)] font-medium"
              />
              <button
                type="submit"
                disabled={!joinCode.trim()}
                className="w-full py-2.5 rounded-xl gradient-primary text-white text-xs font-bold shadow hover:opacity-95 transition disabled:opacity-40"
              >
                Inscribirme Ahora →
              </button>
            </form>
          </div>
        </div>

        {/* ACTION 2: MY PROFILE / ACCESS */}
        <div className="rounded-2xl bg-[var(--card)] border border-[var(--border)] p-6 flex flex-col justify-between shadow-lg hover:border-blue-500/50 transition-all group">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center text-2xl shadow-md group-hover:scale-105 transition-transform">
              👤
            </div>
            <h2 className="text-xl font-black">Mi Perfil / Acceder</h2>
            <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
              Acceso directo para jugadores. Consulta tu rating oficial Glicko-2, racha de victorias,
              mesa asignada y valida los marcadores de tus partidos.
            </p>
          </div>

          <div className="pt-6">
            <Link
              href="/me"
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow transition flex items-center justify-center gap-2"
            >
              <span>Acceder a Mi Portal (/me)</span>
              <span>→</span>
            </Link>
          </div>
        </div>

        {/* ACTION 3: CREATE TOURNAMENT */}
        <div className="rounded-2xl bg-[var(--card)] border border-[var(--border)] p-6 flex flex-col justify-between shadow-lg hover:border-purple-500/50 transition-all group">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-purple-600 text-white flex items-center justify-center text-2xl shadow-md group-hover:scale-105 transition-transform">
              🏓
            </div>
            <h2 className="text-xl font-black">Crear Torneo</h2>
            <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
              Herramienta profesional para directores de club y organizadores. Generación automática de grupos
              equilibrados por ELO y cuadro eliminatorio en 1 clic.
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
      </section>

      {/* Active Tournaments Showcase */}
      <section className="space-y-4 pt-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black">🏆 Torneos del Circuito</h2>
            <p className="text-xs text-[var(--muted-foreground)]">
              Torneos oficiales con seguimiento en tiempo real y acta electrónica.
            </p>
          </div>

          <div className="w-full sm:w-64">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="🔍 Filtrar torneos..."
              className="w-full px-3.5 py-2 rounded-xl bg-[var(--secondary)] border border-[var(--border)] text-xs focus:outline-none focus:border-[var(--primary)]"
            />
          </div>
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

              return (
                <div
                  key={t.id}
                  className="p-5 rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-sm hover:border-[var(--border)]/80 flex flex-col justify-between gap-4 transition-all"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${st.color}`}>
                        {st.label}
                      </span>
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
