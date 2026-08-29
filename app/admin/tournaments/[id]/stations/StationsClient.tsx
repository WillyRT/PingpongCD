'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { TournamentRow, TournamentGroupRow, MatchRow } from '@/lib/types/database';
import { assignMatchTableAction } from '@/lib/actions/admin';
import { verifyMatchScoreAction } from '@/lib/actions/matches';

import { dispatchStationTables } from '@/lib/engine/tables';

interface MatchWithPlayers extends MatchRow {
  player1?: { id: string; name: string; nickname?: string | null; rating?: number; category?: string };
  player2?: { id: string; name: string; nickname?: string | null; rating?: number; category?: string };
}

interface StationsClientProps {
  tournament: TournamentRow;
  groups: TournamentGroupRow[];
  matches: MatchWithPlayers[];
  currentUserId: string;
  userRole: string;
}

export function StationsClient({
  tournament,
  groups,
  matches,
  currentUserId,
  userRole,
}: StationsClientProps) {
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'sub14' | 'plus14'>('all');
  const [activeMediationMatch, setActiveMediationMatch] = useState<MatchWithPlayers | null>(null);
  const [score1, setScore1] = useState<number>(7);
  const [score2, setScore2] = useState<number>(5);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filter matches by category if selected
  const filteredMatches = matches.filter((m) => {
    if (selectedCategory === 'all') return true;
    return m.category === selectedCategory;
  });

  const isPlayoffs = tournament.status === 'bracket_stage';

  // Dynamic 4-table dispatcher:
  // - 4 groups: Fixed 1:1 mapping (Table 1 → Group A, Table 2 → Group B, Table 3 → Group C, Table 4 → Group D)
  // - < 4 groups or Playoffs: Dynamic FIFO dispatch of free tables by priority without idle tables
  const dispatchedTables = dispatchStationTables({
    groups: groups.map((g) => ({ id: g.id, group_code: g.group_code, name: g.group_code })),
    matches: filteredMatches as any,
    isPlayoffs,
  });

  const stations = dispatchedTables.map((d) => ({
    tableNumber: d.tableNumber,
    current: d.currentMatch as MatchWithPlayers | null,
    queue: d.queuedMatches as MatchWithPlayers[],
    groupLabel: d.assignedGroup
      ? `Grupo ${d.assignedGroup.group_code}`
      : isPlayoffs
      ? 'Cruces Eliminatorios (Playoffs)'
      : groups.length < 4
      ? `Mesa Dinámica ${d.tableNumber}`
      : `Mesa ${d.tableNumber}`,
  }));

  // Handle referee assign match to table
  const handleAssignToTable = async (matchId: string, tableNumber: number) => {
    setIsSubmitting(true);
    setMessage(null);
    try {
      const res = await assignMatchTableAction(matchId, tableNumber);
      if (!res.success) {
        setMessage({ type: 'error', text: res.error || 'Error al asignar mesa' });
      } else {
        window.location.reload();
      }
    } catch {
      setMessage({ type: 'error', text: 'Error de red' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open mediation panel for referee
  const handleOpenMediation = (m: MatchWithPlayers) => {
    setActiveMediationMatch(m);
    setScore1(m.score_player1 ?? 7);
    setScore2(m.score_player2 ?? 5);
  };

  // Referee approves official scorecard
  const handleApproveOfficialScore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMediationMatch) return;
    setIsSubmitting(true);
    setMessage(null);

    try {
      const res = await verifyMatchScoreAction({
        matchId: activeMediationMatch.id,
        action: 'confirm',
        overrideScore1: score1,
        overrideScore2: score2,
      });

      if (!res.success) {
        setMessage({ type: 'error', text: res.error || 'Error al aprobar acta oficial' });
      } else {
        setActiveMediationMatch(null);
        window.location.reload();
      }
    } catch {
      setMessage({ type: 'error', text: 'Error inesperado' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen pb-24 max-w-7xl mx-auto px-4 py-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-[var(--border)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href={`/admin/tournaments/${tournament.id}`}
              className="text-xs font-semibold text-[var(--primary)] hover:underline flex items-center gap-1"
            >
              ← Volver al Torneo
            </Link>
            <span className="text-xs text-[var(--muted-foreground)]">/</span>
            <span className="text-xs font-medium text-[var(--muted-foreground)]">Consola de Árbitro</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black flex items-center gap-2">
            🏓 Despacho de 4 Mesas
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
              {tournament.name}
            </span>
          </h1>
          <p className="text-xs text-[var(--muted-foreground)] mt-1">
            Control en vivo de las 4 mesas simultáneas con semáforo de estado, asignación de pistas y arbitraje oficial.
          </p>
        </div>

        {/* Filter by category */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--muted-foreground)] font-semibold">Categoría:</span>
          <div className="flex rounded-xl bg-[var(--card)] p-1 border border-[var(--border)] text-xs font-bold">
            {(['all', 'plus14', 'sub14'] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg transition ${
                  selectedCategory === cat
                    ? 'bg-[var(--primary)] text-white shadow'
                    : 'text-[var(--muted-foreground)] hover:text-white'
                }`}
              >
                {cat === 'all' ? 'Todas' : cat === 'plus14' ? 'Absoluta (+14)' : 'Sub-14'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {message && (
        <div
          className={`my-4 p-3 rounded-xl text-xs font-semibold ${
            message.type === 'error'
              ? 'bg-red-500/15 border border-red-500/30 text-red-400'
              : 'bg-green-500/15 border border-green-500/30 text-green-400'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* 2x2 Grid of 4 Tables */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        {stations.map(({ tableNumber, current, queue, groupLabel }) => {
          // Status semaphore
          // 🟢 Libre | 🔵 En Juego | 🟡 Pendiente Confirmación | 🔴 En Disputa
          let lightColor = 'bg-green-500';
          let lightText = 'Libre';
          let borderTheme = 'border-green-500/30 bg-green-500/5';

          if (current) {
            if (current.status === 'disputed') {
              lightColor = 'bg-red-500 animate-pulse';
              lightText = 'En Disputa';
              borderTheme = 'border-red-500/50 bg-red-500/10 shadow-red-500/10 shadow-lg';
            } else if (current.status === 'pending_verification' || current.status === 'submitted') {
              lightColor = 'bg-amber-400 animate-pulse';
              lightText = 'Pendiente Confirmación';
              borderTheme = 'border-amber-400/50 bg-amber-500/10';
            } else if (current.status === 'in_progress' || current.status === 'scheduled') {
              lightColor = 'bg-blue-500';
              lightText = 'En Juego';
              borderTheme = 'border-blue-500/40 bg-blue-500/10';
            }
          }

          return (
            <div
              key={tableNumber}
              className={`rounded-2xl border p-6 flex flex-col justify-between transition-all ${borderTheme}`}
            >
              <div>
                {/* Station Header */}
                <div className="flex items-center justify-between pb-4 border-b border-[var(--border)]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl gradient-primary text-white font-black flex items-center justify-center text-lg shadow-md">
                      M{tableNumber}
                    </div>
                    <div>
                      <h2 className="text-lg font-extrabold flex items-center gap-2">
                        Mesa {tableNumber}
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--secondary)] text-[var(--muted-foreground)]">
                          {groupLabel}
                        </span>
                      </h2>
                    </div>
                  </div>

                  {/* Semaphore Pill */}
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--card)] border border-[var(--border)] shadow-sm text-xs font-bold">
                    <span className={`w-2.5 h-2.5 rounded-full ${lightColor}`} />
                    <span>{lightText}</span>
                  </div>
                </div>

                {/* Match Details */}
                {current ? (
                  <div className="py-5 space-y-4">
                    {/* Players Matchup */}
                    <div className="p-4 rounded-xl bg-[var(--card)] border border-[var(--border)] shadow-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center text-xs">
                            P1
                          </div>
                          <div>
                            <span className="font-bold text-sm block">
                              {current.player1?.nickname || current.player1?.name || 'Jugador 1'}
                            </span>
                            <span className="text-[10px] text-[var(--muted-foreground)] font-mono">
                              Rating: {Math.round(current.player1?.rating ?? 1500)} pts
                            </span>
                          </div>
                        </div>
                        <div className="text-xl font-black font-mono px-3 py-1 rounded-lg bg-[var(--secondary)]">
                          {current.score_player1 !== null ? current.score_player1 : '-'}
                        </div>
                      </div>

                      <div className="text-center text-[10px] font-bold text-[var(--muted-foreground)] tracking-widest uppercase">
                        VS
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center text-xs">
                            P2
                          </div>
                          <div>
                            <span className="font-bold text-sm block">
                              {current.player2?.nickname || current.player2?.name || 'Jugador 2'}
                            </span>
                            <span className="text-[10px] text-[var(--muted-foreground)] font-mono">
                              Rating: {Math.round(current.player2?.rating ?? 1500)} pts
                            </span>
                          </div>
                        </div>
                        <div className="text-xl font-black font-mono px-3 py-1 rounded-lg bg-[var(--secondary)]">
                          {current.score_player2 !== null ? current.score_player2 : '-'}
                        </div>
                      </div>
                    </div>

                    {/* Dispute Alert if any */}
                    {current.status === 'disputed' && (
                      <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-xs text-red-300 space-y-1">
                        <strong className="block font-bold">⚠️ Conflicto Reportado por Jugador:</strong>
                        <p className="italic">{current.dispute_reason || 'Desacuerdo en el marcador final.'}</p>
                      </div>
                    )}

                    {/* Pending Verification Notice */}
                    {(current.status === 'pending_verification' || current.status === 'submitted') && (
                      <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-xs text-amber-300">
                        ⏳ Tanteo registrado provisionalmente. Esperando confirmación del rival o mediación de árbitro.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-8 text-center text-sm text-[var(--muted-foreground)] flex flex-col items-center justify-center gap-2">
                    <span className="text-3xl">🏓</span>
                    <p className="font-medium">Mesa libre y disponible para juego.</p>
                  </div>
                )}
              </div>

              {/* Station Action Footer */}
              <div className="pt-4 border-t border-[var(--border)] flex flex-col gap-2">
                {current ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenMediation(current)}
                      className="flex-1 py-2.5 rounded-xl gradient-primary text-white text-xs font-bold shadow hover:opacity-90 transition flex items-center justify-center gap-1.5"
                    >
                      ⚖️ Arbitrar / Aprobar Acta
                    </button>
                    {current.status === 'in_progress' && (
                      <button
                        type="button"
                        onClick={() => handleAssignToTable(current.id, 0 as any)}
                        disabled={isSubmitting}
                        className="px-3 py-2.5 rounded-xl bg-[var(--secondary)] hover:bg-[var(--secondary)]/80 text-xs font-semibold transition"
                      >
                        Liberar Mesa
                      </button>
                    )}
                  </div>
                ) : queue.length > 0 ? (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-[var(--muted-foreground)]">
                      Siguiente: <strong>{queue[0]?.player1?.name}</strong> vs <strong>{queue[0]?.player2?.name}</strong>
                    </span>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleAssignToTable(queue[0]!.id, tableNumber)}
                      className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow"
                    >
                      📢 Llamar a Mesa {tableNumber}
                    </button>
                  </div>
                ) : (
                  <div className="text-center text-xs text-[var(--muted-foreground)]">
                    No hay más partidos en cola para esta mesa.
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* REFEREE MEDIATION & OFFICIAL SCORE APPROVAL MODAL */}
      {activeMediationMatch && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-scale-up">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div>
                <h3 className="font-extrabold text-base flex items-center gap-2">
                  ⚖️ Acta Oficial de Partido
                </h3>
                <span className="text-xs text-[var(--muted-foreground)]">
                  Fase: {activeMediationMatch.stage} — Categoría: {activeMediationMatch.category}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveMediationMatch(null)}
                className="text-[var(--muted-foreground)] hover:text-white font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleApproveOfficialScore} className="space-y-4">
              <div className="p-4 rounded-xl bg-[var(--secondary)] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">
                    {activeMediationMatch.player1?.nickname || activeMediationMatch.player1?.name || 'Jugador 1'}
                  </span>
                  <input
                    type="number"
                    min="0"
                    max="99"
                    required
                    value={score1}
                    onChange={(e) => setScore1(parseInt(e.target.value) || 0)}
                    className="w-16 text-center font-mono font-bold text-xl py-1.5 px-2 rounded-lg bg-[var(--card)] border border-[var(--border)] focus:outline-none focus:border-[var(--primary)]"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">
                    {activeMediationMatch.player2?.nickname || activeMediationMatch.player2?.name || 'Jugador 2'}
                  </span>
                  <input
                    type="number"
                    min="0"
                    max="99"
                    required
                    value={score2}
                    onChange={(e) => setScore2(parseInt(e.target.value) || 0)}
                    className="w-16 text-center font-mono font-bold text-xl py-1.5 px-2 rounded-lg bg-[var(--card)] border border-[var(--border)] focus:outline-none focus:border-[var(--primary)]"
                  />
                </div>
              </div>

              <p className="text-[11px] text-[var(--muted-foreground)] leading-relaxed">
                Al pulsar <strong>"Aprobar Acta Oficial"</strong>, el árbitro convalida el resultado definitivo,
                calcula los ratings Glicko-2, avanza al ganador en el cuadro y libera la mesa para el siguiente partido.
              </p>

              <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setActiveMediationMatch(null)}
                  className="px-4 py-2 rounded-xl bg-[var(--secondary)] text-xs font-semibold hover:bg-[var(--secondary)]/80"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl gradient-primary text-white text-xs font-bold shadow-md hover:opacity-90 disabled:opacity-50"
                >
                  {isSubmitting ? 'Aprobando...' : 'Aprobar Acta Oficial'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
