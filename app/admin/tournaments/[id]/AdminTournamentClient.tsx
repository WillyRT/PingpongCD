'use client';

import { useState } from 'react';
import Link from 'next/link';
import type {
  TournamentRow,
  TournamentConfigRow,
  TournamentParticipantRow,
  TournamentGroupRow,
  MatchRow,
  ProfileRow,
  AuditLogRow,
} from '@/lib/types/database';
import { QRCodeView } from '@/components/tournament/QRCodeView';
import { StandingsTable } from '@/components/standings/StandingsTable';
import { BracketView } from '@/components/bracket/BracketView';
import { MatchCard } from '@/components/matches/MatchCard';
import {
  openRegistrationAction,
  generateGroupsAndScheduleAction,
  configureQualifiersAndGenerateBracketAction,
  reassignParticipantGroupAction,
  finishTournamentAction,
} from '@/lib/actions/tournament';
import { resolveDisputeAction } from '@/lib/actions/admin';
import { calculateStandings, type ConfirmedMatch } from '@/lib/engine/standings';
import { calculateCompetitiveBalanceIndex } from '@/lib/engine/cbi';
import { getCategoryLabel } from '@/lib/engine/categories';
import type { AgeCategory } from '@/lib/types/domain';

interface AdminTournamentClientProps {
  tournament: TournamentRow;
  config: TournamentConfigRow | null;
  participants: (TournamentParticipantRow & { profiles?: ProfileRow })[];
  groups: TournamentGroupRow[];
  matches: (MatchRow & { player1?: { id: string; name: string }; player2?: { id: string; name: string } })[];
  auditLogs: (AuditLogRow & { profiles?: { name: string } })[];
  currentUserId: string;
}

export function AdminTournamentClient({
  tournament,
  config,
  participants,
  groups,
  matches,
  auditLogs,
  currentUserId,
}: AdminTournamentClientProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'groups' | 'qualifiers' | 'bracket' | 'disputes' | 'audit' | 'qr'>('overview');
  const [selectedCategory, setSelectedCategory] = useState<AgeCategory | 'all'>('plus14');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qualifiersPerGroup, setQualifiersPerGroup] = useState<number>(config?.qualifiers_per_group ?? 2);

  // Dispute resolution state
  const [selectedDisputeMatch, setSelectedDisputeMatch] = useState<string | null>(null);
  const [disputeResolution, setDisputeResolution] = useState<'accept_score' | 'modify_score' | 'cancel_match' | 'reopen_match'>('accept_score');
  const [overrideScore1, setOverrideScore1] = useState(7);
  const [overrideScore2, setOverrideScore2] = useState(5);

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-500/20 text-gray-400',
    registration: 'bg-blue-500/20 text-blue-400',
    group_stage: 'bg-amber-500/20 text-amber-400',
    bracket_stage: 'bg-purple-500/20 text-purple-400',
    finished: 'bg-green-500/20 text-green-400',
  };

  // Filter items by category
  const filteredParticipants = selectedCategory === 'all'
    ? participants
    : participants.filter((p) => (p.category ?? 'plus14') === selectedCategory);

  const filteredGroups = selectedCategory === 'all'
    ? groups
    : groups.filter((g) => (g.category ?? 'plus14') === selectedCategory);

  const filteredMatches = selectedCategory === 'all'
    ? matches
    : matches.filter((m) => (m.category ?? 'plus14') === selectedCategory);

  const disputedMatches = filteredMatches.filter((m) => m.status === 'disputed');
  const groupMatches = filteredMatches.filter((m) => m.stage === 'group');
  const bracketMatches = filteredMatches.filter((m) => m.stage !== 'group');

  // Player names & ratings maps
  const playerNames = new Map<string, string>();
  const ratingsMap = new Map<string, number>();
  for (const p of participants) {
    if (p.profiles) {
      playerNames.set(p.user_id, p.profiles.name);
      ratingsMap.set(p.user_id, p.profiles.rating);
    }
  }

  // Calculate CBI for the filtered groups
  const cbiResult = calculateCompetitiveBalanceIndex(
    filteredGroups.map((g, idx) => ({
      groupIndex: idx,
      groupCode: g.group_code,
      players: filteredParticipants
        .filter((p) => p.group_id === g.id)
        .map((p) => ({ id: p.user_id, rating: p.profiles?.rating ?? 1500 })),
    }))
  );

  // Handlers
  const handleOpenRegistration = async () => {
    setLoading(true);
    setError(null);
    const res = await openRegistrationAction(tournament.id);
    if (!res.success) setError(res.error || 'Failed to open registration');
    setLoading(false);
  };

  const handleGenerateGroups = async () => {
    setLoading(true);
    setError(null);
    const targetCat = selectedCategory === 'all' ? undefined : selectedCategory;
    const res = await generateGroupsAndScheduleAction(tournament.id, targetCat);
    if (!res.success) setError(res.error || 'Failed to generate groups');
    setLoading(false);
  };

  const handleReassignGroup = async (userId: string, targetGroupId: string) => {
    setLoading(true);
    setError(null);
    const res = await reassignParticipantGroupAction(tournament.id, userId, targetGroupId);
    if (!res.success) setError(res.error || 'Failed to reassign participant');
    setLoading(false);
  };

  const handleGenerateBracket = async () => {
    setLoading(true);
    setError(null);
    const targetCat = selectedCategory === 'all' ? 'plus14' : selectedCategory;
    const res = await configureQualifiersAndGenerateBracketAction(tournament.id, qualifiersPerGroup, targetCat);
    if (!res.success) setError(res.error || 'Failed to generate bracket');
    setLoading(false);
  };

  const handleFinishTournament = async () => {
    if (!confirm('¿Estás seguro de finalizar el torneo? Esto consolidará los ratings definitivos en rating_states.')) {
      return;
    }
    setLoading(true);
    setError(null);
    const res = await finishTournamentAction(tournament.id);
    if (!res.success) setError(res.error || 'Failed to finish tournament');
    setLoading(false);
  };

  const handleResolveDispute = async (matchId: string) => {
    setLoading(true);
    setError(null);
    const res = await resolveDisputeAction({
      matchId,
      resolution: disputeResolution,
      scorePlayer1: disputeResolution === 'modify_score' ? overrideScore1 : undefined,
      scorePlayer2: disputeResolution === 'modify_score' ? overrideScore2 : undefined,
    });
    if (!res.success) setError(res.error || 'Failed to resolve dispute');
    else setSelectedDisputeMatch(null);
    setLoading(false);
  };

  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const qrUrl = `${appUrl}/join/${tournament.slug}`;

  return (
    <main className="min-h-screen pb-20">
      {/* Header */}
      <header className="glass sticky top-0 z-50 px-4 py-3 border-b border-[var(--border)]">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-sm font-semibold text-[var(--muted-foreground)] hover:text-white">
              ← Dashboard
            </Link>
            <span className="text-[var(--border)]">|</span>
            <h1 className="font-bold text-base truncate max-w-xs">{tournament.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase ${statusColors[tournament.status] ?? 'bg-gray-500/20'}`}>
              {tournament.status.replace('_', ' ')}
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Error banner */}
        {error && (
          <div className="p-4 rounded-xl bg-[var(--destructive)]/10 border border-[var(--destructive)]/20 text-[var(--destructive)] text-sm">
            {error}
          </div>
        )}

        {/* Category Selector Tabs */}
        <div className="p-2 rounded-2xl bg-[var(--card)] border border-[var(--border)] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[var(--muted-foreground)] px-2 uppercase tracking-wider">
              Categoría:
            </span>
            <button
              onClick={() => setSelectedCategory('plus14')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                selectedCategory === 'plus14'
                  ? 'bg-blue-500 text-white shadow-md'
                  : 'bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-white'
              }`}
            >
              🔵 {getCategoryLabel('plus14')} ({participants.filter(p => (p.category ?? 'plus14') === 'plus14').length})
            </button>
            <button
              onClick={() => setSelectedCategory('sub14')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                selectedCategory === 'sub14'
                  ? 'bg-amber-500 text-white shadow-md'
                  : 'bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-white'
              }`}
            >
              🧒 {getCategoryLabel('sub14')} ({participants.filter(p => (p.category ?? 'plus14') === 'sub14').length})
            </button>
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition ${
                selectedCategory === 'all'
                  ? 'bg-[var(--primary)] text-white shadow-md'
                  : 'bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-white'
              }`}
            >
              Ver Todas
            </button>
          </div>

          <Link
            href={`/join/${tournament.slug}`}
            target="_blank"
            className="px-3 py-1.5 rounded-lg bg-[var(--secondary)] text-xs font-semibold text-[var(--primary)] hover:bg-[var(--secondary)]/80 flex items-center gap-1.5"
          >
            🔗 Página de Registro
          </Link>
        </div>

        {/* Phase Control Banner */}
        <div className="p-6 rounded-2xl bg-[var(--card)] border border-[var(--border)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-[var(--muted-foreground)] uppercase">
              FASE ACTUAL DEL TORNEO
            </div>
            <div className="text-2xl font-extrabold capitalize">
              {tournament.status.replace('_', ' ')}
            </div>
            <div className="text-sm text-[var(--muted-foreground)] mt-1">
              {tournament.status === 'draft' && 'Abre las inscripciones para que los jugadores puedan registrarse.'}
              {tournament.status === 'registration' && `${filteredParticipants.length} jugadores inscritos en esta categoría. Genera los grupos cuando estés listo.`}
              {tournament.status === 'group_stage' && 'Fase de grupos en curso. Los tanteos y desempates con ELO dinámico se actualizan en vivo.'}
              {tournament.status === 'bracket_stage' && 'Fase de eliminatorias en curso.'}
              {tournament.status === 'finished' && 'Torneo finalizado y ratings consolidados. 🎉'}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            {tournament.status === 'draft' && (
              <button
                type="button"
                disabled={loading}
                onClick={handleOpenRegistration}
                className="w-full md:w-auto px-6 py-3 rounded-xl gradient-primary text-white font-semibold text-sm disabled:opacity-50"
              >
                {loading ? 'Procesando...' : '▶ Abrir Inscripciones'}
              </button>
            )}

            {tournament.status === 'registration' && (
              <button
                type="button"
                disabled={loading || filteredParticipants.length < 4}
                onClick={handleGenerateGroups}
                className="w-full md:w-auto px-6 py-3 rounded-xl gradient-primary text-white font-semibold text-sm disabled:opacity-50"
              >
                {loading ? 'Generando...' : `⚡ Generar Grupos y Empezar (${filteredParticipants.length} jug.)`}
              </button>
            )}

            {tournament.status === 'group_stage' && (
              <button
                type="button"
                onClick={() => setActiveTab('qualifiers')}
                className="w-full md:w-auto px-6 py-3 rounded-xl gradient-accent text-white font-semibold text-sm"
              >
                🏆 Configurar Clasificados y Cuadro
              </button>
            )}

            {tournament.status !== 'finished' && (
              <button
                type="button"
                disabled={loading}
                onClick={handleFinishTournament}
                className="w-full md:w-auto px-4 py-3 rounded-xl bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 font-semibold text-sm disabled:opacity-50 transition"
              >
                🏁 Finalizar Torneo
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-2 border-b border-[var(--border)] overflow-x-auto pb-2">
          {[
            { key: 'overview', label: `Participantes (${filteredParticipants.length})` },
            { key: 'groups', label: `Grupos y Clasificación (${filteredGroups.length})` },
            { key: 'qualifiers', label: 'Configurar Playoffs' },
            { key: 'bracket', label: `Cuadro Playoffs (${bracketMatches.length})` },
            { key: 'disputes', label: `Partidos y Disputas (${disputedMatches.length})` },
            { key: 'qr', label: 'QR e Invitación' },
            { key: 'audit', label: 'Auditoría' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition ${
                activeTab === tab.key
                  ? 'bg-[var(--primary)] text-white'
                  : 'bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB 1: OVERVIEW & PARTICIPANTS */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-slide-up">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-[var(--card)] border border-[var(--border)] text-center">
                <div className="text-2xl font-bold text-[var(--primary)]">{filteredParticipants.length}</div>
                <div className="text-xs text-[var(--muted-foreground)] mt-1">Participantes</div>
              </div>
              <div className="p-4 rounded-xl bg-[var(--card)] border border-[var(--border)] text-center">
                <div className="text-2xl font-bold">{filteredGroups.length}</div>
                <div className="text-xs text-[var(--muted-foreground)] mt-1">Grupos</div>
              </div>
              <div className="p-4 rounded-xl bg-[var(--card)] border border-[var(--border)] text-center">
                <div className="text-2xl font-bold text-[var(--accent)]">
                  {filteredMatches.filter((m) => m.status === 'confirmed').length} / {filteredMatches.length}
                </div>
                <div className="text-xs text-[var(--muted-foreground)] mt-1">Partidos Jugados</div>
              </div>
              <div className="p-4 rounded-xl bg-[var(--card)] border border-[var(--border)] text-center">
                <div className="text-2xl font-bold text-red-400">{disputedMatches.length}</div>
                <div className="text-xs text-[var(--muted-foreground)] mt-1">Disputas</div>
              </div>
            </div>

            {/* Participants list with manual group reassignment */}
            <div className="p-6 rounded-2xl bg-[var(--card)] border border-[var(--border)] space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-base">Participantes Inscritos ({filteredParticipants.length})</h3>
                <span className="text-xs text-[var(--muted-foreground)]">
                  Puedes reasignar grupos manualmente antes del inicio
                </span>
              </div>
              {filteredParticipants.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)]">No hay jugadores inscritos en esta categoría.</p>
              ) : (
                <div className="divide-y divide-[var(--border)]">
                  {filteredParticipants.map((p, idx) => (
                    <div key={p.user_id} className="py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono text-[var(--muted-foreground)] w-6">
                          #{p.seed_number ?? idx + 1}
                        </span>
                        <div>
                          <div className="font-medium text-sm flex items-center gap-2">
                            {p.profiles?.name || 'Jugador'}
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-[var(--secondary)]">
                              Nivel {p.declared_level ?? p.profiles?.declared_level ?? 5.0}
                            </span>
                          </div>
                          <div className="text-xs text-[var(--muted-foreground)]">
                            Rating: {p.profiles?.rating?.toFixed(0) ?? 1500} • Partidos: {p.profiles?.matches_played ?? 0}
                          </div>
                        </div>
                      </div>

                      {filteredGroups.length > 0 && (
                        <div className="flex items-center gap-2">
                          <select
                            disabled={loading || tournament.status === 'finished'}
                            value={p.group_id ?? ''}
                            onChange={(e) => handleReassignGroup(p.user_id, e.target.value)}
                            className="text-xs px-2.5 py-1 rounded-lg bg-[var(--secondary)] border border-[var(--border)] focus:outline-none"
                          >
                            <option value="">Sin Grupo</option>
                            {filteredGroups.map((g) => (
                              <option key={g.id} value={g.id}>
                                Grupo {g.group_code}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: GROUPS, CBI & LIVE STANDINGS */}
        {activeTab === 'groups' && (
          <div className="space-y-6 animate-slide-up">
            {/* CBI Visualizer Banner */}
            {filteredGroups.length > 0 && (
              <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-amber-500/10 border border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider">
                    Competitive Balance Index (CBI)
                  </div>
                  <div className="text-lg font-extrabold text-[var(--foreground)] mt-0.5">
                    {cbiResult.symmetryText}
                  </div>
                  <div className="text-xs text-[var(--muted-foreground)] mt-1">
                    Diferencia máxima media entre grupos: {cbiResult.maxDifference} pts • Media global: {cbiResult.overallMeanRating}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-extrabold font-mono text-[var(--primary)]">
                    {cbiResult.cbiPercentage}%
                  </div>
                  <div className="text-[10px] text-[var(--muted-foreground)] uppercase font-semibold">
                    Índice de Simetría
                  </div>
                </div>
              </div>
            )}

            {filteredGroups.length === 0 ? (
              <div className="p-12 rounded-2xl bg-[var(--card)] border border-[var(--border)] text-center">
                <p className="text-[var(--muted-foreground)]">Los grupos de esta categoría aún no han sido generados.</p>
              </div>
            ) : (
              filteredGroups.map((grp) => {
                const groupPlayers = filteredParticipants.filter((p) => p.group_id === grp.id);
                const playerIds = groupPlayers.map((p) => p.user_id);
                const groupMatchesConfirmed: ConfirmedMatch[] = filteredMatches
                  .filter((m) => m.group_id === grp.id && m.status === 'confirmed')
                  .map((m) => ({
                    player1Id: m.player1_id,
                    player2Id: m.player2_id,
                    score1: m.score_player1 ?? 0,
                    score2: m.score_player2 ?? 0,
                    winnerId: m.winner_id ?? '',
                  }));

                const seedsMap = new Map<string, number>();
                for (const p of groupPlayers) {
                  if (p.seed_number) seedsMap.set(p.user_id, p.seed_number);
                }

                // 5-tier standings with live dynamic ELO
                const standings = calculateStandings(playerIds, groupMatchesConfirmed, seedsMap, ratingsMap);

                return (
                  <div key={grp.id} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-lg">Grupo {grp.group_code}</h3>
                      <span className="text-xs text-[var(--muted-foreground)]">
                        Estado: <strong className="text-white">{grp.status}</strong>
                      </span>
                    </div>
                    <StandingsTable standings={standings} playerNames={playerNames} groupCode={grp.group_code} />
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB 3: QUALIFIERS CONFIG */}
        {activeTab === 'qualifiers' && (
          <div className="p-6 rounded-2xl bg-[var(--card)] border border-[var(--border)] space-y-6 animate-slide-up max-w-xl mx-auto">
            <div>
              <h3 className="text-lg font-bold">Configurar Clasificados a Eliminatorias</h3>
              <p className="text-sm text-[var(--muted-foreground)] mt-1">
                Elige cuántos jugadores de cada grupo acceden al cuadro final de eliminación directa.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Clasificados por grupo
                </label>
                <div className="grid grid-cols-4 gap-3">
                  {[1, 2, 3, 4].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setQualifiersPerGroup(num)}
                      className={`py-3 rounded-xl font-bold text-sm transition ${
                        qualifiersPerGroup === num
                          ? 'bg-[var(--primary)] text-white ring-2 ring-[var(--primary)]/50'
                          : 'bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-white'
                      }`}
                    >
                      Top {num}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[var(--secondary)] border border-[var(--border)] text-xs text-[var(--muted-foreground)] space-y-1">
                <div>Total clasificados: <strong className="text-white">{filteredGroups.length * qualifiersPerGroup}</strong></div>
                <div>Formato de cuadro: <strong className="text-white">{filteredGroups.length * qualifiersPerGroup <= 4 ? 'Semifinales + Final' : 'Cuartos + Semifinales + Final'}</strong></div>
              </div>

              <button
                type="button"
                disabled={loading || filteredGroups.length === 0}
                onClick={handleGenerateBracket}
                className="w-full py-4 rounded-xl gradient-accent text-white font-semibold text-sm disabled:opacity-50 transition hover:scale-[1.01]"
              >
                {loading ? 'Generando Cuadro...' : '⚡ Generar Cuadro Automático de Playoffs'}
              </button>
            </div>
          </div>
        )}

        {/* TAB 4: BRACKET */}
        {activeTab === 'bracket' && (
          <div className="space-y-6 animate-slide-up">
            {bracketMatches.length === 0 ? (
              <div className="p-12 rounded-2xl bg-[var(--card)] border border-[var(--border)] text-center">
                <p className="text-[var(--muted-foreground)]">El cuadro de playoffs de esta categoría aún no ha sido generado.</p>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-lg">Cuadro de Playoffs ({getCategoryLabel(selectedCategory === 'all' ? 'plus14' : selectedCategory)})</h3>
                </div>
                <BracketView
                  matches={bracketMatches.map((m, idx) => ({
                    id: m.id,
                    round: m.stage === 'quarterfinal' ? 1 : m.stage === 'semifinal' ? 2 : 3,
                    position: idx,
                    player1: m.player1 ? { id: m.player1_id, name: m.player1.name } : null,
                    player2: m.player2 ? { id: m.player2_id, name: m.player2.name } : null,
                    score1: m.score_player1,
                    score2: m.score_player2,
                    winner: m.winner_id ? { id: m.winner_id, name: playerNames.get(m.winner_id) ?? 'Ganador' } : null,
                    stage: m.stage,
                    status: m.status as any,
                    isBye: false,
                  }))}
                  totalRounds={bracketMatches.some((m) => m.stage === 'quarterfinal') ? 3 : 2}
                />
              </div>
            )}
          </div>
        )}

        {/* TAB 5: MATCHES & DISPUTES */}
        {activeTab === 'disputes' && (
          <div className="space-y-6 animate-slide-up">
            <h3 className="font-bold text-lg">Mesa de Control de Partidos ({filteredMatches.length})</h3>

            {filteredMatches.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)]">No hay partidos programados aún.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredMatches.map((m) => (
                  <MatchCard
                    key={m.id}
                    match={m as any}
                    currentUserId={currentUserId}
                    isAdmin={true}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 6: QR CODE & INVITATION */}
        {activeTab === 'qr' && (
          <div className="animate-slide-up">
            <QRCodeView url={qrUrl} tournamentName={tournament.name} />
          </div>
        )}

        {/* TAB 7: AUDIT LOGS */}
        {activeTab === 'audit' && (
          <div className="p-6 rounded-2xl bg-[var(--card)] border border-[var(--border)] space-y-4 animate-slide-up">
            <h3 className="font-bold text-base">Registro de Auditoría de Modificaciones</h3>
            {auditLogs.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)]">No hay registros de auditoría aún.</p>
            ) : (
              <div className="divide-y divide-[var(--border)] font-mono text-xs">
                {auditLogs.map((log) => (
                  <div key={log.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-[var(--primary)]">{log.action}</span>
                      <span className="text-[var(--muted-foreground)] ml-2">por {log.profiles?.name ?? 'Admin'}</span>
                    </div>
                    <span className="text-[var(--muted-foreground)]">
                      {new Date(log.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
