'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { dispatchStationTables, type TableDispatchState } from '@/lib/engine/tables';
import { useRealtimeMatches } from '@/lib/hooks/useRealtimeMatches';
import type { TournamentRow, TournamentGroupRow, MatchRow } from '@/lib/types/database';

interface PlayerInfo {
  id: string;
  name: string;
  nickname?: string | null;
  rating?: number | null;
  category?: string | null;
  grip_style?: 'shakehand' | 'penhold' | null;
  rubber_type?: string | null;
}

export interface TableMonitorMatch extends MatchRow {
  player1?: PlayerInfo;
  player2?: PlayerInfo;
}

interface TablesMonitorClientProps {
  tournament: TournamentRow | null;
  allTournaments: TournamentRow[];
  groups: TournamentGroupRow[];
  matches: TableMonitorMatch[];
}

export function TablesMonitorClient({
  tournament,
  allTournaments,
  groups,
  matches: initialMatches,
}: TablesMonitorClientProps) {
  const router = useRouter();
  const matches = useRealtimeMatches(tournament?.id || '', initialMatches);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    }
  };

  // Clock
  useEffect(() => {
    const update = () => {
      setCurrentTime(
        new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto-refresh for live screen
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      router.refresh();
    }, 10000); // 10s auto-refresh
    return () => clearInterval(interval);
  }, [autoRefresh, router]);

  if (!tournament) {
    return (
      <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] flex items-center justify-center p-6">
        <div className="max-w-md p-8 rounded-2xl bg-[var(--card)] border-2 border-[var(--border)] text-center space-y-4">
          <span className="text-4xl">🏓</span>
          <h2 className="text-xl font-black">No hay torneos activos en curso</h2>
          <p className="text-xs text-[var(--muted-foreground)]">
            Crea un torneo o inicia la fase de grupos desde el panel de control.
          </p>
          <Link
            href="/"
            className="inline-block px-4 py-2 rounded-xl gradient-primary text-white text-xs font-bold shadow"
          >
            Volver al Inicio
          </Link>
        </div>
      </div>
    );
  }

  const isPlayoffs = tournament.status === 'bracket_stage';

  // Compute 4 Physical Tables Dispatch using verified invariant
  const dispatched: TableDispatchState[] = dispatchStationTables({
    groups: groups.map((g) => ({ id: g.id, group_code: g.group_code, name: g.group_code })),
    matches: matches as any,
    isPlayoffs,
  });

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] p-4 sm:p-6 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-[var(--card)] border-2 border-[var(--border)] shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-600 text-white font-black text-2xl flex items-center justify-center shadow">
            🏓
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-400 font-mono text-[10px] font-black uppercase">
                Monitor Oficial en Directo
              </span>
              <span className="text-xs font-mono font-bold text-amber-400 tabular-nums">
                🕒 {currentTime}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-[var(--foreground)] tracking-tight">
              {tournament.name}
            </h1>
          </div>
        </div>

        {/* Quick Tournament Switcher & Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {allTournaments.length > 1 && (
            <select
              value={tournament.id}
              onChange={(e) => {
                router.push(`/tables?tournamentId=${e.target.value}`);
              }}
              className="px-3 py-1.5 rounded-xl bg-[var(--secondary)] border-2 border-[var(--border)] text-xs font-bold text-[var(--foreground)]"
            >
              {allTournaments.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.status})
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition ${
              autoRefresh
                ? 'bg-green-500/20 text-green-300 border-green-500/40'
                : 'bg-[var(--secondary)] text-[var(--muted-foreground)] border-[var(--border)]'
            }`}
          >
            {autoRefresh ? '⚡ Refresco Activo (10s)' : '⏸️ Refresco Pausado'}
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="px-3 py-1.5 rounded-xl bg-[var(--secondary)] border-2 border-[var(--border)] text-xs font-bold hover:bg-[var(--secondary)]/80 transition flex items-center gap-1.5"
            title="Modo Pantalla Completa para Proyector o Tablet"
          >
            <span>⛶</span>
            <span>{isFullscreen ? 'Salir Pantalla' : 'Pantalla Completa'}</span>
          </button>

          <Link
            href={`/admin/tournaments/${tournament.id}/stations`}
            className="px-3 py-1.5 rounded-xl bg-[var(--secondary)] border-2 border-[var(--border)] text-xs font-bold hover:bg-[var(--secondary)]/80 transition"
          >
            ⚙️ Control Árbitro
          </Link>
        </div>
      </div>

      {/* 2x2 Matrix for the 4 Physical Tables */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {dispatched.map((table) => {
          const current = table.currentMatch as TableMonitorMatch | null;
          const assignedCode = table.assignedGroup?.group_code || String.fromCharCode(64 + table.tableNumber);
          const groupTitle = isPlayoffs ? 'Cruces Eliminatorios (Playoffs)' : `Grupo G${assignedCode}`;

          return (
            <div
              key={table.tableNumber}
              className={`p-5 rounded-2xl border-4 shadow-xl transition space-y-4 ${
                table.isIdle
                  ? 'bg-[var(--card)] border-green-500/50'
                  : table.statusLight === 'red'
                  ? 'bg-[var(--card)] border-red-500/70 shadow-red-500/20'
                  : table.statusLight === 'yellow'
                  ? 'bg-[var(--card)] border-yellow-500/70 shadow-yellow-500/20'
                  : 'bg-[var(--card)] border-blue-500/70 shadow-blue-500/20'
              }`}
            >
              {/* Table Header */}
              <div className="flex items-center justify-between border-b-2 border-[var(--border)] pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-9 h-9 rounded-xl bg-black text-white font-black text-lg flex items-center justify-center shadow">
                    {table.tableNumber}
                  </span>
                  <div>
                    <h2 className="text-lg font-black text-[var(--foreground)] leading-none">
                      MESA {table.tableNumber}
                    </h2>
                    <span className="text-xs font-bold text-[var(--muted-foreground)]">
                      {groupTitle}
                    </span>
                  </div>
                </div>

                {/* Accessible Status Indicator (Icon + Text + Color) */}
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-xl text-xs font-black uppercase tracking-wider border flex items-center gap-1.5 shadow-sm ${
                    table.isIdle
                      ? 'bg-neutral-500/15 text-neutral-500 border-neutral-500/30'
                      : table.statusLight === 'red'
                      ? 'bg-red-500/20 text-red-500 border-red-500/40'
                      : table.statusLight === 'yellow'
                      ? 'bg-amber-500/20 text-amber-500 border-amber-500/40'
                      : 'bg-emerald-500/20 text-emerald-600 border-emerald-500/40'
                  }`}>
                    <span>
                      {table.isIdle
                        ? '⚪'
                        : table.statusLight === 'red'
                        ? '🔴'
                        : table.statusLight === 'yellow'
                        ? '⏳'
                        : '🟢'}
                    </span>
                    <span>
                      {table.isIdle
                        ? 'DISPONIBLE'
                        : table.statusLight === 'red'
                        ? 'EN DISPUTA'
                        : table.statusLight === 'yellow'
                        ? 'CALENTANDO'
                        : 'EN PISTA'}
                    </span>
                  </span>
                </div>
              </div>

              {/* Table Body */}
              {current ? (
                <div className="space-y-3">
                  {/* Players Matchup */}
                  <div className="p-3.5 rounded-xl bg-[var(--secondary)] border-2 border-[var(--border)] space-y-2.5">
                    {/* Player 1 */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate">
                        <span className="font-black text-sm text-[var(--foreground)] block truncate">
                          {current.player1?.nickname || current.player1?.name || 'Jugador 1'}
                        </span>
                        <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-[var(--muted-foreground)]">
                          <span className="font-mono font-bold tabular-nums">
                            {Math.round(current.player1?.rating ?? 1500)} ELO
                          </span>
                          {current.player1?.grip_style && (
                            <span className="px-1.5 py-0.5 rounded bg-black/40 text-amber-300 font-bold">
                              {current.player1.grip_style === 'penhold' ? '🥢 Lapicero' : '🏓 Clásica'}
                            </span>
                          )}
                          {current.player1?.rubber_type && (
                            <span className="px-1.5 py-0.5 rounded bg-black/40 text-blue-300 font-bold">
                              {current.player1.rubber_type}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="min-w-[48px] h-11 px-2.5 rounded-xl bg-[var(--card)] border-2 border-[var(--border)] font-black text-2xl tabular-nums flex items-center justify-center shadow-inner">
                        {current.score_player1 ?? '-'}
                      </div>
                    </div>

                    <div className="text-center font-black text-[10px] text-[var(--muted-foreground)] uppercase tracking-widest">
                      VS
                    </div>

                    {/* Player 2 */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate">
                        <span className="font-black text-sm text-[var(--foreground)] block truncate">
                          {current.player2?.nickname || current.player2?.name || 'Jugador 2'}
                        </span>
                        <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-[var(--muted-foreground)]">
                          <span className="font-mono font-bold tabular-nums">
                            {Math.round(current.player2?.rating ?? 1500)} ELO
                          </span>
                          {current.player2?.grip_style && (
                            <span className="px-1.5 py-0.5 rounded bg-black/40 text-amber-300 font-bold">
                              {current.player2.grip_style === 'penhold' ? '🥢 Lapicero' : '🏓 Clásica'}
                            </span>
                          )}
                          {current.player2?.rubber_type && (
                            <span className="px-1.5 py-0.5 rounded bg-black/40 text-blue-300 font-bold">
                              {current.player2.rubber_type}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="min-w-[48px] h-11 px-2.5 rounded-xl bg-[var(--card)] border-2 border-[var(--border)] font-black text-2xl tabular-nums flex items-center justify-center shadow-inner">
                        {current.score_player2 ?? '-'}
                      </div>
                    </div>
                  </div>

                  {current.dispute_reason && (
                    <div className="p-2.5 rounded-xl bg-red-500/20 border-2 border-red-500/50 text-red-300 text-xs font-bold">
                      ⚠️ Impugnado: {current.dispute_reason}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 rounded-xl bg-green-500/10 border-2 border-dashed border-green-500/40 text-center space-y-2">
                  <span className="text-3xl">🟢</span>
                  <h3 className="font-black text-sm text-green-400 uppercase tracking-wide">
                    Mesa Libre y Disponible
                  </h3>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Esperando siguiente partido de {groupTitle}.
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Lower Section: Siguientes en Pista (On Deck) */}
      <div className="p-5 rounded-2xl bg-[var(--card)] border-2 border-[var(--border)] shadow-md space-y-4">
        <div className="flex items-center justify-between border-b-2 border-[var(--border)] pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">⏳</span>
            <h2 className="text-base font-black text-[var(--foreground)] uppercase tracking-wider">
              Siguientes en Pista (On Deck / A Calentar)
            </h2>
          </div>
          <span className="text-xs text-[var(--muted-foreground)] font-bold">
            Los jugadores deben aproximarse a las pistas indicadas
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {dispatched.map((table) => {
            const queue = table.queuedMatches as TableMonitorMatch[];
            const nextInLine = queue[0] || null;

            return (
              <div
                key={table.tableNumber}
                className="p-3.5 rounded-xl bg-[var(--secondary)] border-2 border-[var(--border)] space-y-2"
              >
                <div className="flex items-center justify-between text-xs font-black">
                  <span>Mesa {table.tableNumber}</span>
                  <span className="px-2 py-0.5 rounded bg-black/40 text-[10px] text-[var(--muted-foreground)]">
                    {queue.length} en espera
                  </span>
                </div>

                {nextInLine ? (
                  <div className="space-y-1 text-xs">
                    <span className="block font-bold text-amber-300 truncate">
                      1. {nextInLine.player1?.nickname || nextInLine.player1?.name || 'Jugador 1'}
                    </span>
                    <span className="block font-bold text-amber-300 truncate">
                      vs {nextInLine.player2?.nickname || nextInLine.player2?.name || 'Jugador 2'}
                    </span>
                    <span className="block text-[10px] text-[var(--muted-foreground)]">
                      Estado: {nextInLine.status === 'scheduled' ? 'Programado' : 'Pendiente'}
                    </span>
                  </div>
                ) : (
                  <p className="text-[11px] text-[var(--muted-foreground)] italic">
                    Sin partidos pendientes en cola para esta mesa.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
