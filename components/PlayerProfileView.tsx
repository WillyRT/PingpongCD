'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { getCategoryLabel } from '@/lib/engine/categories';
import { updatePlayerMaterialAction } from '@/lib/actions/admin';
import type { ProfileRow } from '@/lib/types/database';
import type { AgeCategory } from '@/lib/types/domain';

export interface MatchDetailItem {
  id: string;
  tournament_id: string;
  tournament_name?: string;
  tournament_slug?: string;
  tournament_year?: number;
  stage: string;
  group_code?: string | null;
  player1_id: string;
  player2_id: string;
  score_player1: number | null;
  score_player2: number | null;
  winner_id: string | null;
  is_upset?: boolean;
  created_at: string;
  player1?: { id: string; name: string; nickname?: string | null; rating?: number; category?: string } | null;
  player2?: { id: string; name: string; nickname?: string | null; rating?: number; category?: string } | null;
}

export interface RatingSnapshotItem {
  id: string;
  historical_tournament_id?: string;
  rating_before: number;
  rd_before: number;
  rating_after: number;
  rd_after: number;
  matches_in_period: number;
  wins_in_period: number;
  created_at?: string;
}

interface PlayerProfileViewProps {
  profile: ProfileRow;
  matches: MatchDetailItem[];
  snapshots?: RatingSnapshotItem[];
  participations?: any[];
  isOwnProfile?: boolean;
}

export function PlayerProfileView({
  profile,
  matches,
  snapshots = [],
  participations = [],
  isOwnProfile = false,
}: PlayerProfileViewProps) {
  const [selectedTournament, setSelectedTournament] = useState<string>('all');
  const [filterResult, setFilterResult] = useState<'all' | 'win' | 'loss'>('all');
  const [searchRival, setSearchRival] = useState('');

  // Informative Material Badges State
  const [gripStyle, setGripStyle] = useState<'shakehand' | 'penhold' | null>(profile.grip_style || null);
  const [rubberType, setRubberType] = useState<string>(profile.rubber_type || '');
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [materialSaving, setMaterialSaving] = useState(false);

  const handleSaveMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    setMaterialSaving(true);
    try {
      await updatePlayerMaterialAction({
        gripStyle,
        rubberType: rubberType.trim() || null,
      });
      setShowMaterialModal(false);
    } finally {
      setMaterialSaving(false);
    }
  };

  const displayName = profile.nickname || profile.name || 'Jugador';
  const playerRating = Math.round(profile.rating ?? 1500);
  const playerRd = Math.round(profile.rating_deviation ?? 350);

  // Compute comprehensive stats
  const stats = useMemo(() => {
    let wins = 0;
    let losses = 0;
    let pointsFor = 0;
    let pointsAgainst = 0;
    let upsetWins = 0;
    let currentStreak = 0;
    let streakActive = true;
    let maxWinStreak = 0;
    let tempStreak = 0;

    const tournamentsSet = new Set<string>();

    // Sorted chronological for streak calculation
    const chronological = [...matches].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    for (const m of chronological) {
      if (m.tournament_name) tournamentsSet.add(m.tournament_name);
      const isWinner = m.winner_id === profile.id;
      if (isWinner) {
        tempStreak++;
        if (tempStreak > maxWinStreak) maxWinStreak = tempStreak;
      } else {
        tempStreak = 0;
      }
    }

    // Reverse (most recent first) for current streak
    const recentFirst = [...chronological].reverse();
    for (const m of recentFirst) {
      const isP1 = m.player1_id === profile.id;
      const myScore = isP1 ? (m.score_player1 ?? 0) : (m.score_player2 ?? 0);
      const oppScore = isP1 ? (m.score_player2 ?? 0) : (m.score_player1 ?? 0);
      pointsFor += myScore;
      pointsAgainst += oppScore;

      const isWinner = m.winner_id === profile.id;
      if (isWinner) {
        wins++;
        if (m.is_upset) upsetWins++;
        if (streakActive) currentStreak++;
      } else {
        losses++;
        streakActive = false;
      }
    }

    const totalMatches = matches.length || profile.matches_played || (wins + losses);
    const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;
    const pointDiff = pointsFor - pointsAgainst;

    return {
      wins,
      losses,
      totalMatches,
      winRate,
      pointsFor,
      pointsAgainst,
      pointDiff,
      upsetWins,
      currentStreak,
      maxWinStreak,
      tournamentsCount: tournamentsSet.size || participations.length,
    };
  }, [matches, profile.id, profile.matches_played, participations.length]);

  // Tournament list for filter
  const tournamentOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of matches) {
      const tName = m.tournament_name || 'Torneo Histórico';
      map.set(m.tournament_id, tName);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [matches]);

  // Filtered matches
  const filteredMatches = useMemo(() => {
    return matches.filter((m) => {
      // Tournament filter
      if (selectedTournament !== 'all' && m.tournament_id !== selectedTournament) {
        return false;
      }

      // Win / Loss filter
      const isWin = m.winner_id === profile.id;
      if (filterResult === 'win' && !isWin) return false;
      if (filterResult === 'loss' && isWin) return false;

      // Rival search
      if (searchRival.trim()) {
        const isP1 = m.player1_id === profile.id;
        const opp = isP1 ? m.player2 : m.player1;
        const oppName = (opp?.nickname || opp?.name || '').toLowerCase();
        if (!oppName.includes(searchRival.toLowerCase().trim())) {
          return false;
        }
      }

      return true;
    });
  }, [matches, selectedTournament, filterResult, searchRival, profile.id]);

  const initials = displayName
    .split(' ')
    .slice(0, 2)
    .map((n) => n.charAt(0).toUpperCase())
    .join('');

  return (
    <div className="space-y-6 max-w-5xl mx-auto w-full">
      {/* Back button if public profile */}
      {!isOwnProfile && (
        <div className="flex items-center justify-between">
          <Link
            href="/leaderboard"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--muted-foreground)] hover:text-white transition"
          >
            ← Volver al Ranking General
          </Link>
          <Link
            href="/"
            className="text-xs text-[var(--muted-foreground)] hover:text-white transition"
          >
            Inicio
          </Link>
        </div>
      )}

      {/* 1. Header Card */}
      <div className="p-6 md:p-8 rounded-3xl bg-[var(--card)] border border-[var(--border)] shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4 md:gap-6">
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl gradient-primary flex items-center justify-center text-white text-3xl md:text-4xl font-black shadow-xl shrink-0 border border-white/20">
              {initials}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-2xl md:text-3xl font-black text-white">{displayName}</h1>
                {isOwnProfile && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    Mi Cuenta
                  </span>
                )}
              </div>

              <div className="text-xs text-[var(--muted-foreground)] flex flex-wrap items-center gap-2 mt-1">
                <span className="font-semibold text-white px-2 py-0.5 rounded bg-[var(--secondary)]">
                  {profile.category ? getCategoryLabel(profile.category as AgeCategory) : 'Categoría General'}
                </span>

                {/* Material Badges (Informative only) */}
                {gripStyle && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {gripStyle === 'penhold' ? '🥢 Lapicero (Penhold)' : '🏓 Clásica (Shakehand)'}
                  </span>
                )}
                {rubberType && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    Gomas: {rubberType}
                  </span>
                )}
                {isOwnProfile && (
                  <button
                    type="button"
                    onClick={() => setShowMaterialModal(true)}
                    className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--secondary)] text-[var(--foreground)] border border-[var(--border)] hover:border-amber-400 transition"
                  >
                    ⚙️ Mi Material
                  </button>
                )}

                <span>•</span>
                <span>{stats.tournamentsCount} {stats.tournamentsCount === 1 ? 'Torneo disputado' : 'Torneos disputados'}</span>
                {isOwnProfile && profile.email && (
                  <>
                    <span>•</span>
                    <span className="text-[var(--muted-foreground)]">{profile.email}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Rating Pill */}
          <div className="p-4 md:p-5 rounded-2xl bg-[var(--secondary)]/80 border border-[var(--border)] text-left md:text-right shrink-0">
            <div className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider">
              Rating Glicko-2
            </div>
            <div className="text-3xl md:text-4xl font-black font-mono text-[var(--primary)] mt-0.5">
              {playerRating}
            </div>
            <div className="text-[11px] text-[var(--muted-foreground)] font-medium mt-0.5">
              Incertidumbre: ±{playerRd} RD
            </div>
          </div>
        </div>

        {/* 2. Key Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3 mt-6 pt-6 border-t border-[var(--border)]">
          <div className="p-3.5 rounded-xl bg-[var(--secondary)]/40 border border-[var(--border)]/50 text-center">
            <div className="text-2xl font-black text-white">{stats.totalMatches}</div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] mt-0.5">
              Partidos
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[var(--secondary)]/40 border border-[var(--border)]/50 text-center">
            <div className="text-2xl font-black text-green-400">
              {stats.wins} - {stats.losses}
            </div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] mt-0.5">
              Victorias - Derrotas
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[var(--secondary)]/40 border border-[var(--border)]/50 text-center">
            <div className="text-2xl font-black text-amber-400">{stats.winRate}%</div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] mt-0.5">
              Efectividad
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[var(--secondary)]/40 border border-[var(--border)]/50 text-center">
            <div className={`text-2xl font-black ${stats.pointDiff >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {stats.pointDiff > 0 ? `+${stats.pointDiff}` : stats.pointDiff}
            </div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] mt-0.5">
              Dif. Puntos ({stats.pointsFor}/{stats.pointsAgainst})
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[var(--secondary)]/40 border border-[var(--border)]/50 text-center col-span-2 sm:col-span-1">
            <div className="text-2xl font-black text-purple-400">
              {stats.currentStreak > 0 ? `🔥 ${stats.currentStreak}` : '0'}
            </div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] mt-0.5">
              Racha Actual (Máx {stats.maxWinStreak})
            </div>
          </div>
        </div>
      </div>

      {/* 3. Detailed Match History Section */}
      <div className="p-6 md:p-8 rounded-3xl bg-[var(--card)] border border-[var(--border)] shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <span>📋</span>
              <span>Historial de Partidos (2023–2026)</span>
            </h2>
            <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
              Registro completo de los {matches.length} enfrentamientos oficiales auditados
            </p>
          </div>

          {/* Result Filter Tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[var(--secondary)] border border-[var(--border)] self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setFilterResult('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                filterResult === 'all' ? 'bg-[var(--primary)] text-white shadow' : 'text-[var(--muted-foreground)] hover:text-white'
              }`}
            >
              Todos ({matches.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterResult('win')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                filterResult === 'win' ? 'bg-green-600 text-white shadow' : 'text-[var(--muted-foreground)] hover:text-white'
              }`}
            >
              Victorias ({stats.wins})
            </button>
            <button
              type="button"
              onClick={() => setFilterResult('loss')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                filterResult === 'loss' ? 'bg-red-600 text-white shadow' : 'text-[var(--muted-foreground)] hover:text-white'
              }`}
            >
              Derrotas ({stats.losses})
            </button>
          </div>
        </div>

        {/* Filters Bar: Tournament selector & Rival Search */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div>
            <label className="block text-[11px] font-bold text-[var(--muted-foreground)] uppercase tracking-wider mb-1">
              Filtrar por Edición / Torneo
            </label>
            <select
              value={selectedTournament}
              onChange={(e) => setSelectedTournament(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--secondary)] border border-[var(--border)] text-xs font-medium text-white focus:outline-none focus:border-[var(--primary)]"
            >
              <option value="all">Todas las ediciones ({tournamentOptions.length} torneos)</option>
              {tournamentOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[var(--muted-foreground)] uppercase tracking-wider mb-1">
              Buscar por Nombre de Rival
            </label>
            <input
              type="text"
              value={searchRival}
              onChange={(e) => setSearchRival(e.target.value)}
              placeholder="Ej. Carlos Ross, Pablo Olalla..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--secondary)] border border-[var(--border)] text-xs text-white focus:outline-none focus:border-[var(--primary)]"
            />
          </div>
        </div>

        {/* Matches List */}
        {filteredMatches.length === 0 ? (
          <div className="text-center py-12 rounded-2xl bg-[var(--secondary)]/30 border border-dashed border-[var(--border)] text-[var(--muted-foreground)] text-sm">
            No se encontraron partidos con los filtros aplicados.
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {filteredMatches.map((m) => {
              const isP1 = m.player1_id === profile.id;
              const myScore = isP1 ? m.score_player1 : m.score_player2;
              const oppScore = isP1 ? m.score_player2 : m.score_player1;
              const opp = isP1 ? m.player2 : m.player1;
              const oppId = opp?.id || (isP1 ? m.player2_id : m.player1_id);
              const oppName = opp?.nickname || opp?.name || 'Rival';
              const oppRating = opp?.rating ? Math.round(opp.rating) : null;
              const won = m.winner_id === profile.id;

              const stageLabel =
                m.stage === 'group'
                  ? (m.group_code ? `Grupo ${m.group_code}` : 'Fase de Grupos')
                  : m.stage === 'round_of_16'
                  ? 'Octavos de Final'
                  : m.stage === 'quarterfinal' || m.stage === 'quarter'
                  ? 'Cuartos de Final'
                  : m.stage === 'semifinal' || m.stage === 'semi'
                  ? 'Semifinal'
                  : m.stage === 'final'
                  ? 'Gran Final'
                  : m.stage;

              return (
                <div
                  key={m.id}
                  className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[var(--secondary)]/20 px-2 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Badge V / D */}
                    <span
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 shadow-inner ${
                        won
                          ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                          : 'bg-red-500/20 text-red-400 border border-red-500/30'
                      }`}
                    >
                      {won ? 'V' : 'D'}
                    </span>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-[var(--muted-foreground)]">vs</span>
                        <Link
                          href={`/player/${oppId}`}
                          className="font-bold text-sm text-white hover:text-[var(--primary)] hover:underline truncate"
                        >
                          {oppName}
                        </Link>
                        {oppRating && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[var(--secondary)] text-[var(--muted-foreground)]">
                            ELO {oppRating}
                          </span>
                        )}
                        {m.is_upset && won && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            ⚡ Sorpresa
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-[var(--muted-foreground)] flex items-center gap-2 mt-0.5">
                        {m.tournament_slug ? (
                          <Link
                            href={`/t/${m.tournament_slug}`}
                            className="hover:text-white hover:underline text-[var(--muted-foreground)]"
                          >
                            {m.tournament_name || 'Torneo'}
                          </Link>
                        ) : (
                          <span>{m.tournament_name || 'Torneo'}</span>
                        )}
                        <span>•</span>
                        <span className="font-medium text-white/80">{stageLabel}</span>
                      </div>
                    </div>
                  </div>

                  {/* Score & Result Pill */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 pl-13 sm:pl-0">
                    <div className="font-mono font-black text-xl text-right">
                      <span className={won ? 'text-green-400' : 'text-white'}>{myScore}</span>
                      <span className="text-[var(--muted-foreground)] mx-1.5">-</span>
                      <span className={!won ? 'text-red-400' : 'text-[var(--muted-foreground)]'}>
                        {oppScore}
                      </span>
                    </div>

                    <span
                      className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider shrink-0 ${
                        won
                          ? 'bg-green-500/15 text-green-400 border border-green-500/30'
                          : 'bg-red-500/15 text-red-400 border border-red-500/30'
                      }`}
                    >
                      {won ? 'Victoria' : 'Derrota'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Tournaments Participated */}
      {participations && participations.length > 0 && (
        <div className="p-6 md:p-8 rounded-3xl bg-[var(--card)] border border-[var(--border)] shadow-xl space-y-4">
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <span>🏆</span>
            <span>Ediciones y Torneos ({participations.length})</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {participations.map((p: any) => {
              const t = p.tournaments;
              return (
                <Link
                  key={p.tournament_id}
                  href={`/t/${t?.slug || p.tournament_id}`}
                  className="p-4 rounded-2xl bg-[var(--secondary)]/50 border border-[var(--border)] hover:border-[var(--primary)] transition flex flex-col justify-between group shadow-sm"
                >
                  <div>
                    <div className="font-bold text-sm text-white group-hover:text-[var(--primary)] transition">
                      {t?.name || 'Torneo'}
                    </div>
                    <div className="text-xs text-[var(--muted-foreground)] capitalize mt-1">
                      Estado: {String(t?.status ?? '').replace('_', ' ')}
                    </div>
                  </div>

                  <div className="mt-3 text-[11px] font-bold text-[var(--primary)] flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    <span>Ver Cuadro y Clasificación →</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Material Edit Modal */}
      {showMaterialModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[var(--card)] border-2 border-[var(--border)] rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-4 animate-scale-up text-left">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div>
                <h4 className="font-black text-sm text-[var(--foreground)]">Empuñadura y Material de Pala</h4>
                <p className="text-[11px] text-[var(--muted-foreground)]">Badge visual para las pantallas del torneo</p>
              </div>
              <button
                type="button"
                onClick={() => setShowMaterialModal(false)}
                className="w-9 h-9 rounded-xl bg-[var(--secondary)] text-[var(--foreground)] font-bold flex items-center justify-center hover:bg-red-500/20 transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveMaterial} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[var(--foreground)] mb-1.5">
                  Estilo de Empuñadura:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setGripStyle('shakehand')}
                    className={`p-3 rounded-xl border-2 text-xs font-bold text-center transition ${
                      gripStyle === 'shakehand'
                        ? 'bg-blue-600 text-white border-black shadow'
                        : 'bg-[var(--secondary)] text-[var(--foreground)] border-[var(--border)]'
                    }`}
                  >
                    <span className="text-base block mb-0.5">🏓</span>
                    Clásica (Shakehand)
                  </button>
                  <button
                    type="button"
                    onClick={() => setGripStyle('penhold')}
                    className={`p-3 rounded-xl border-2 text-xs font-bold text-center transition ${
                      gripStyle === 'penhold'
                        ? 'bg-amber-500 text-black border-black shadow font-black'
                        : 'bg-[var(--secondary)] text-[var(--foreground)] border-[var(--border)]'
                    }`}
                  >
                    <span className="text-base block mb-0.5">🥢</span>
                    Lapicero (Penhold)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--foreground)] mb-1">
                  Tipo de Gomas:
                </label>
                <input
                  type="text"
                  value={rubberType}
                  onChange={(e) => setRubberType(e.target.value)}
                  placeholder="Ej: Lisas (ambas caras) / Picos largos en revés"
                  className="w-full p-2.5 rounded-xl bg-[var(--secondary)] border-2 border-[var(--border)] text-xs text-[var(--foreground)] focus:outline-none"
                />
                <p className="text-[10px] text-[var(--muted-foreground)] mt-1">
                  * Únicamente informativo para rivales y público. No modifica el algoritmo de rating ELO.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowMaterialModal(false)}
                  className="px-4 py-2 rounded-xl bg-[var(--secondary)] text-xs font-bold border border-[var(--border)]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={materialSaving}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow transition disabled:opacity-50"
                >
                  {materialSaving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
