'use client';

import { useState } from 'react';
import Link from 'next/link';

export interface GroupStandingItem {
  playerId: string;
  position: number;
  played: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  pointsDiff: number;
  seed: number;
  playerName: string;
  playerCategory?: string;
  finalRating: number;
}

export interface GroupMatchItem {
  id: string;
  group_id: string;
  stage: string;
  player1_id: string;
  player2_id: string;
  score_player1: number | null;
  score_player2: number | null;
  winner_id: string | null;
  status: string;
  player1Name: string;
  player2Name: string;
}

export interface GroupData {
  id: string;
  group_code: string;
  category: string;
  standings: GroupStandingItem[];
  matches: GroupMatchItem[];
}

export interface KnockoutMatchItem {
  id: string;
  stage: string;
  player1_id: string;
  player2_id: string;
  score_player1: number | null;
  score_player2: number | null;
  winner_id: string | null;
  status: string;
  player1Name: string;
  player2Name: string;
}

interface TournamentViewClientProps {
  tournament: {
    id: string;
    name: string;
    slug: string;
    status: string;
    created_at: string;
  };
  groups: GroupData[];
  knockoutMatches: KnockoutMatchItem[];
  totalPlayers: number;
  totalMatches: number;
  isRegistered: boolean;
  userLoggedIn: boolean;
}

export function TournamentViewClient({
  tournament,
  groups,
  knockoutMatches,
  totalPlayers,
  totalMatches,
  isRegistered,
  userLoggedIn,
}: TournamentViewClientProps) {
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'groups' | 'bracket'>('groups');

  const isSub = tournament.name.toLowerCase().includes('sub');
  const categoryLabel = isSub ? 'Sub-14 / Sub-16' : 'Senior (+14)';

  const statusConfig: Record<string, { label: string; color: string; icon: string }> = {
    draft: { label: 'Próximamente', color: 'text-gray-400 bg-gray-500/10 border-gray-500/30', icon: '📋' },
    registration: { label: 'Inscripciones Abiertas', color: 'text-green-400 bg-green-500/10 border-green-500/30', icon: '✅' },
    group_stage: { label: 'Fase de Grupos en Curso', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30', icon: '⚔️' },
    bracket_stage: { label: 'Fase Eliminatoria', color: 'text-purple-400 bg-purple-500/10 border-purple-500/30', icon: '🏆' },
    finished: { label: 'Torneo Finalizado', color: 'text-blue-400 bg-blue-500/10 border-blue-500/30', icon: '🎉' },
  };

  const fallbackStatus = { label: 'Torneo Finalizado', color: 'text-blue-400 bg-blue-500/10 border-blue-500/30', icon: '🎉' };
  const status = statusConfig[tournament.status] ?? fallbackStatus;

  const filteredGroups =
    selectedGroupId === 'all'
      ? groups
      : groups.filter((g) => g.id === selectedGroupId);

  const formatGroupName = (code: string) => {
    if (code.startsWith('G') && code.length === 2 && !isNaN(Number(code[1]))) {
      return `Grupo ${code[1]}`;
    }
    if (code.startsWith('G') && code.length === 2) {
      return `Grupo ${code[1]}`;
    }
    return `Grupo ${code}`;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-slide-up">
      {/* 1. Header Card */}
      <div className="p-6 md:p-10 rounded-3xl bg-[var(--card)] border border-[var(--border)] shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl gradient-primary flex items-center justify-center text-4xl md:text-5xl shadow-xl shrink-0 border border-white/20">
              🏓
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">
                  {tournament.name}
                </h1>
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${status.color}`}>
                  {status.icon} {status.label}
                </span>
              </div>
              <div className="text-xs text-[var(--muted-foreground)] flex flex-wrap items-center gap-2.5">
                <span className="font-semibold text-white px-2 py-0.5 rounded bg-[var(--secondary)]">
                  {categoryLabel}
                </span>
                <span>•</span>
                <span>Circuito Oficial PingPongCD</span>
                <span>•</span>
                <span>Edición Histórica Auditada</span>
              </div>
            </div>
          </div>

          {/* Quick Stats Pills */}
          <div className="grid grid-cols-3 gap-2.5 sm:gap-4 shrink-0 bg-[var(--secondary)]/50 p-3 rounded-2xl border border-[var(--border)]">
            <div className="text-center px-2">
              <div className="text-xl md:text-2xl font-black text-white">{totalPlayers}</div>
              <div className="text-[10px] uppercase font-bold text-[var(--muted-foreground)] tracking-wider">
                Jugadores
              </div>
            </div>
            <div className="text-center px-2 border-x border-[var(--border)]">
              <div className="text-xl md:text-2xl font-black text-amber-400">{groups.length}</div>
              <div className="text-[10px] uppercase font-bold text-[var(--muted-foreground)] tracking-wider">
                Grupos
              </div>
            </div>
            <div className="text-center px-2">
              <div className="text-xl md:text-2xl font-black text-green-400">{totalMatches}</div>
              <div className="text-[10px] uppercase font-bold text-[var(--muted-foreground)] tracking-wider">
                Partidos
              </div>
            </div>
          </div>
        </div>

        {/* Action if open for registration */}
        {(tournament.status === 'registration' || tournament.status === 'draft') && !isRegistered && (
          <div className="mt-8 pt-6 border-t border-[var(--border)] flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <div className="font-bold text-white text-sm">¿Quieres participar en este torneo?</div>
              <div className="text-xs text-[var(--muted-foreground)]">Inscripción inmediata en 1 solo clic.</div>
            </div>
            <Link
              href={`/join/${tournament.id}`}
              className="px-6 py-3 rounded-xl gradient-primary text-white font-bold text-sm shadow-lg hover:scale-105 transition-transform"
            >
              🏓 Inscribirme al Torneo
            </Link>
          </div>
        )}
      </div>

      {/* 2. Navigation Tabs (Grupos / Eliminatorias) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-[var(--secondary)] border border-[var(--border)] self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('groups')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition ${
              activeTab === 'groups'
                ? 'bg-[var(--primary)] text-white shadow-lg'
                : 'text-[var(--muted-foreground)] hover:text-white'
            }`}
          >
            Fase de Grupos ({groups.length})
          </button>
          {knockoutMatches.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveTab('bracket')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition ${
                activeTab === 'bracket'
                  ? 'bg-[var(--primary)] text-white shadow-lg'
                  : 'text-[var(--muted-foreground)] hover:text-white'
              }`}
            >
              Fase Eliminatoria ({knockoutMatches.length})
            </button>
          )}
        </div>

        {/* Group Selector Dropdown / Pills */}
        {activeTab === 'groups' && groups.length > 1 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setSelectedGroupId('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                selectedGroupId === 'all'
                  ? 'bg-white text-black font-black'
                  : 'bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-white border border-[var(--border)]'
              }`}
            >
              Todos los Grupos
            </button>
            {groups.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setSelectedGroupId(g.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  selectedGroupId === g.id
                    ? 'bg-white text-black font-black'
                    : 'bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-white border border-[var(--border)]'
                }`}
              >
                {formatGroupName(g.group_code)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 3. Groups Standings & Matches Content */}
      {activeTab === 'groups' && (
        <div className="space-y-10">
          {filteredGroups.map((group) => (
            <div
              key={group.id}
              className="p-6 md:p-8 rounded-3xl bg-[var(--card)] border border-[var(--border)] shadow-xl space-y-6"
            >
              {/* Group Title Header */}
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
                <div>
                  <h2 className="text-xl font-black text-white flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-[var(--primary)]/20 text-[var(--primary)] flex items-center justify-center text-sm font-black border border-[var(--primary)]/30">
                      {group.group_code}
                    </span>
                    <span>{formatGroupName(group.group_code)}</span>
                  </h2>
                  <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                    {group.standings.length} Jugadores • {group.matches.length} Partidos disputados
                  </p>
                </div>

                <span className="text-xs font-bold px-3 py-1 rounded-full bg-[var(--secondary)] text-[var(--muted-foreground)] border border-[var(--border)]">
                  Fase de Grupos
                </span>
              </div>

              {/* Standings Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs uppercase bg-[var(--secondary)]/60 text-[var(--muted-foreground)]">
                    <tr>
                      <th className="px-3 py-3 text-center w-10">POS</th>
                      <th className="px-4 py-3">JUGADOR</th>
                      <th className="px-3 py-3 text-center">PJ</th>
                      <th className="px-3 py-3 text-center font-bold text-green-400">PG</th>
                      <th className="px-3 py-3 text-center text-red-400">PP</th>
                      <th className="px-3 py-3 text-center">PF</th>
                      <th className="px-3 py-3 text-center">PC</th>
                      <th className="px-3 py-3 text-center font-bold">DIF</th>
                      <th className="px-4 py-3 text-center font-mono font-extrabold text-[var(--primary)]">
                        ELO
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {group.standings.map((s, idx) => {
                      const isTop2 = idx < 2;
                      return (
                        <tr
                          key={s.playerId}
                          className={`hover:bg-[var(--secondary)]/40 transition-colors ${
                            isTop2 ? 'bg-amber-500/[0.02]' : ''
                          }`}
                        >
                          <td className="px-3 py-3 text-center font-bold text-xs">
                            <span
                              className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-black ${
                                idx === 0
                                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                  : idx === 1
                                  ? 'bg-slate-400/20 text-slate-300 border border-slate-400/30'
                                  : 'text-[var(--muted-foreground)]'
                              }`}
                            >
                              {s.position}º
                            </span>
                          </td>

                          <td className="px-4 py-3 font-semibold">
                            <Link
                              href={`/player/${s.playerId}`}
                              className="inline-flex items-center gap-2 hover:text-[var(--primary)] hover:underline group transition"
                            >
                              <span className="w-7 h-7 rounded-lg bg-[var(--secondary)] flex items-center justify-center text-xs font-bold text-white group-hover:bg-[var(--primary)] transition">
                                {s.playerName.charAt(0).toUpperCase()}
                              </span>
                              <span className="text-white font-bold">{s.playerName}</span>
                            </Link>
                          </td>

                          <td className="px-3 py-3 text-center text-[var(--muted-foreground)]">{s.played}</td>
                          <td className="px-3 py-3 text-center font-black text-green-400">{s.wins}</td>
                          <td className="px-3 py-3 text-center font-semibold text-red-400">{s.losses}</td>
                          <td className="px-3 py-3 text-center text-xs text-[var(--muted-foreground)]">{s.pointsFor}</td>
                          <td className="px-3 py-3 text-center text-xs text-[var(--muted-foreground)]">{s.pointsAgainst}</td>
                          <td className="px-3 py-3 text-center font-mono font-bold">
                            <span className={s.pointsDiff >= 0 ? 'text-green-400' : 'text-red-400'}>
                              {s.pointsDiff > 0 ? `+${s.pointsDiff}` : s.pointsDiff}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center font-mono font-black text-[var(--primary)]">
                            {s.finalRating}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Group Matches / Actas Confirmadas */}
              <div className="pt-4 border-t border-[var(--border)] space-y-3">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-[var(--muted-foreground)] flex items-center gap-2">
                  <span>⚔️</span>
                  <span>Partidos y Marcadores del Grupo ({group.matches.length})</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {group.matches.map((m) => {
                    const p1Won = m.winner_id === m.player1_id;
                    const p2Won = m.winner_id === m.player2_id;

                    return (
                      <div
                        key={m.id}
                        className="p-3 rounded-2xl bg-[var(--secondary)]/40 border border-[var(--border)]/70 flex items-center justify-between gap-3 text-xs"
                      >
                        {/* Players */}
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className={`w-2 h-2 rounded-full ${p1Won ? 'bg-green-400' : 'bg-transparent'}`} />
                            <Link
                              href={`/player/${m.player1_id}`}
                              className={`truncate hover:underline ${p1Won ? 'font-black text-white' : 'text-[var(--muted-foreground)]'}`}
                            >
                              {m.player1Name}
                            </Link>
                          </div>
                          <div className="flex items-center gap-1.5 truncate">
                            <span className={`w-2 h-2 rounded-full ${p2Won ? 'bg-green-400' : 'bg-transparent'}`} />
                            <Link
                              href={`/player/${m.player2_id}`}
                              className={`truncate hover:underline ${p2Won ? 'font-black text-white' : 'text-[var(--muted-foreground)]'}`}
                            >
                              {m.player2Name}
                            </Link>
                          </div>
                        </div>

                        {/* Scores */}
                        <div className="font-mono font-black text-base text-right shrink-0 bg-[var(--card)] px-3 py-1.5 rounded-xl border border-[var(--border)]">
                          <span className={p1Won ? 'text-green-400' : 'text-white'}>{m.score_player1}</span>
                          <span className="text-[var(--muted-foreground)] mx-1">-</span>
                          <span className={p2Won ? 'text-green-400' : 'text-white'}>{m.score_player2}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 4. Knockout Matches / Bracket Content */}
      {activeTab === 'bracket' && (
        <div className="p-6 md:p-8 rounded-3xl bg-[var(--card)] border border-[var(--border)] shadow-xl space-y-6">
          <div className="border-b border-[var(--border)] pb-4">
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <span>🏆</span>
              <span>Cuadro de Cruces y Fase Eliminatoria</span>
            </h2>
            <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
              Partidos de eliminatoria directa por el título
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {knockoutMatches.map((m) => {
              const p1Won = m.winner_id === m.player1_id;
              const p2Won = m.winner_id === m.player2_id;

              return (
                <div
                  key={m.id}
                  className="p-4 rounded-2xl bg-[var(--secondary)]/50 border border-[var(--border)] flex items-center justify-between gap-4"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="text-[10px] font-extrabold uppercase text-[var(--primary)] tracking-wider">
                      {m.stage}
                    </div>
                    <div className="flex items-center gap-2 truncate">
                      <Link
                        href={`/player/${m.player1_id}`}
                        className={`truncate text-sm ${p1Won ? 'font-black text-white' : 'text-[var(--muted-foreground)]'}`}
                      >
                        {m.player1Name}
                      </Link>
                    </div>
                    <div className="flex items-center gap-2 truncate">
                      <Link
                        href={`/player/${m.player2_id}`}
                        className={`truncate text-sm ${p2Won ? 'font-black text-white' : 'text-[var(--muted-foreground)]'}`}
                      >
                        {m.player2Name}
                      </Link>
                    </div>
                  </div>

                  <div className="font-mono font-black text-xl text-right shrink-0 bg-[var(--card)] px-4 py-2 rounded-xl border border-[var(--border)]">
                    <span className={p1Won ? 'text-green-400' : 'text-white'}>{m.score_player1}</span>
                    <span className="text-[var(--muted-foreground)] mx-1.5">-</span>
                    <span className={p2Won ? 'text-green-400' : 'text-white'}>{m.score_player2}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
