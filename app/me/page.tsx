import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getPlayerSession } from '@/lib/auth/player-session';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { calculateWinProbability } from '@/lib/engine/analytics';
import { calculateStandings } from '@/lib/engine/standings';
import { getCategoryLabel } from '@/lib/engine/categories';
import { PlayerActiveMatchCard } from '@/components/PlayerActiveMatchCard';
import type { AgeCategory } from '@/lib/types/domain';

export default async function PlayerPortalPage() {
  const supabase = await createClient();
  const admin = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  const playerSession = await getPlayerSession();

  const targetPlayerId = user?.id || playerSession?.playerId;
  if (!targetPlayerId) redirect('/login?redirectTo=/me');

  // Fetch player profile
  const { data: profile } = await admin
    .from('profiles')
    .select('*')
    .or(`id.eq.${targetPlayerId},user_id.eq.${targetPlayerId}`)
    .maybeSingle();

  if (!profile) redirect('/login?redirectTo=/me');

  const displayName = profile.nickname || profile.name || 'Jugador';
  const playerRating = Math.round(profile.rating ?? 1500);
  const playerRd = Math.round(profile.rating_deviation ?? 350);

  // Fetch all matches involving this player
  const { data: allMatches } = await admin
    .from('matches')
    .select(`
      *,
      player1:player1_id (id, name, nickname, rating, category),
      player2:player2_id (id, name, nickname, rating, category),
      tournaments:tournament_id (id, name, slug, status)
    `)
    .or(`player1_id.eq.${profile.id},player2_id.eq.${profile.id}`)
    .order('created_at', { ascending: false });

  // Calculate stats: Wins, Losses, Streaks, Upsets
  let wins = 0;
  let losses = 0;
  let upsetWins = 0;
  let currentStreak = 0;
  let streakCounted = false;

  const confirmedMatches = (allMatches || []).filter((m) => m.status === 'confirmed');

  for (const m of confirmedMatches) {
    const isWinner = m.winner_id === profile.id;
    if (isWinner) {
      wins++;
      if (m.is_upset) upsetWins++;
      if (!streakCounted) currentStreak++;
    } else {
      losses++;
      streakCounted = true;
    }
  }

  const totalPlayed = profile.matches_played || (wins + losses);
  const winRate = totalPlayed > 0 ? Math.round((wins / totalPlayed) * 100) : 0;

  // Active / Ongoing Tournament Participations
  const { data: participations } = await admin
    .from('tournament_participants')
    .select(`
      *,
      tournaments:tournament_id (*),
      tournament_groups:group_id (*)
    `)
    .eq('user_id', profile.id);

  // Find active tournament (group_stage or bracket_stage)
  const activeParticipation = (participations || []).find((p) => {
    const st = (p.tournaments as any)?.status;
    return st === 'group_stage' || st === 'bracket_stage';
  });

  // Next Pending Match for the active tournament or general pending
  const pendingMatches = (allMatches || []).filter(
    (m) =>
      m.status === 'pending' ||
      m.status === 'scheduled' ||
      m.status === 'in_progress' ||
      m.status === 'submitted' ||
      m.status === 'pending_verification' ||
      m.status === 'disputed'
  );
  const nextMatch = pendingMatches[0] || null;

  // Compute Win Expectancy for Next Match
  let winExpectancy: number | null = null;
  let opponent: { id: string; name: string; rating: number } | null = null;

  if (nextMatch) {
    const isP1 = nextMatch.player1_id === profile.id;
    const oppObj = isP1 ? (nextMatch.player2 as any) : (nextMatch.player1 as any);
    const oppRating = Math.round(oppObj?.rating ?? 1500);
    opponent = {
      id: oppObj?.id ?? (isP1 ? nextMatch.player2_id : nextMatch.player1_id),
      name: oppObj?.nickname || oppObj?.name || 'Rival por definir',
      rating: oppRating,
    };

    const prob = calculateWinProbability(playerRating, oppRating);
    winExpectancy = prob.percentage1;
  }

  // Calculate Live Standing in current group if in group_stage
  let groupPosition: number | null = null;
  let totalInGroup: number | null = null;

  if (activeParticipation && activeParticipation.group_id) {
    const { data: grpMatches } = await admin
      .from('matches')
      .select('*')
      .eq('group_id', activeParticipation.group_id)
      .eq('status', 'confirmed');

    const { data: grpParticipants } = await admin
      .from('tournament_participants')
      .select('user_id, seed')
      .eq('group_id', activeParticipation.group_id);

    if (grpParticipants && grpParticipants.length > 0) {
      totalInGroup = grpParticipants.length;
      const playerIds = grpParticipants.map((p) => p.user_id);
      const seedsMap = new Map<string, number>();
      grpParticipants.forEach((p) => seedsMap.set(p.user_id, p.seed ?? 99));

      const standings = calculateStandings(
        playerIds,
        (grpMatches || []).map((m) => ({
          player1Id: m.player1_id,
          player2Id: m.player2_id,
          score1: m.score_player1 ?? 0,
          score2: m.score_player2 ?? 0,
          winnerId: m.winner_id ?? '',
        })),
        seedsMap
      );

      const myStanding = standings.find((s) => s.playerId === profile.id);
      if (myStanding) {
        groupPosition = myStanding.position;
      }
    }
  }

  const nextMatchData = nextMatch
    ? {
        id: nextMatch.id,
        tournamentId: nextMatch.tournament_id,
        tournamentName:
          (activeParticipation?.tournaments as any)?.name ||
          (nextMatch.tournaments as any)?.name ||
          'Torneo Oficial',
        stage: nextMatch.stage,
        tableNumber: nextMatch.table_number,
        player1Id: nextMatch.player1_id,
        player2Id: nextMatch.player2_id,
        player1Name: (nextMatch.player1 as any)?.nickname || (nextMatch.player1 as any)?.name || 'Jugador 1',
        player2Name: (nextMatch.player2 as any)?.nickname || (nextMatch.player2 as any)?.name || 'Jugador 2',
        player1Rating: Math.round((nextMatch.player1 as any)?.rating ?? 1500),
        player2Rating: Math.round((nextMatch.player2 as any)?.rating ?? 1500),
        scorePlayer1: nextMatch.score_player1,
        scorePlayer2: nextMatch.score_player2,
        status: nextMatch.status,
        reportedBy: nextMatch.reported_by_id || nextMatch.reported_by,
        winExpectancy: winExpectancy ? winExpectancy / 100 : null,
      }
    : null;

  return (
    <main className="min-h-screen pb-24 bg-[var(--background)] text-[var(--foreground)]">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6 animate-slide-up">
        {/* 1. Main Profile Card */}
        <div className="p-6 rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center text-white text-2xl font-black shadow-lg">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-extrabold tracking-tight">{displayName}</h1>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    {profile.role === 'admin' || profile.role === 'super_admin' ? 'Admin' : 'Jugador Oficial'}
                  </span>
                </div>
                <div className="text-xs text-[var(--muted-foreground)] mt-0.5 flex items-center gap-2">
                  <span>{profile.email || 'Sin email registrado'}</span>
                  <span>•</span>
                  <span className="font-semibold text-white">
                    {profile.category ? getCategoryLabel(profile.category as AgeCategory) : 'Categoría General'}
                  </span>
                  <span>•</span>
                  <a href="/auth/signout" className="text-red-400/80 hover:text-red-400 hover:underline transition">
                    Cerrar sesión
                  </a>
                </div>
              </div>
            </div>

            {/* ELO Rating Badge */}
            <div className="text-left sm:text-right bg-[var(--secondary)]/60 sm:bg-transparent p-3 sm:p-0 rounded-xl sm:rounded-none w-full sm:w-auto">
              <div className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                Rating Glicko-2
              </div>
              <div className="text-3xl font-black font-mono text-[var(--primary)] mt-0.5">
                {playerRating}
              </div>
              <div className="text-[11px] text-[var(--muted-foreground)] font-medium">
                Incertidumbre: ±{playerRd} RD
              </div>
            </div>
          </div>

          {/* Key Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-[var(--border)] text-center">
            <div className="p-2.5 rounded-xl bg-[var(--secondary)]/40">
              <div className="text-xl font-black text-white">{totalPlayed}</div>
              <div className="text-[11px] text-[var(--muted-foreground)] font-semibold mt-0.5 uppercase tracking-wide">Partidos</div>
            </div>
            <div className="p-2.5 rounded-xl bg-[var(--secondary)]/40">
              <div className="text-xl font-black text-green-400">{wins} - {losses}</div>
              <div className="text-[11px] text-[var(--muted-foreground)] font-semibold mt-0.5 uppercase tracking-wide">Victorias - Derrotas</div>
            </div>
            <div className="p-2.5 rounded-xl bg-[var(--secondary)]/40">
              <div className="text-xl font-black text-amber-400">{winRate}%</div>
              <div className="text-[11px] text-[var(--muted-foreground)] font-semibold mt-0.5 uppercase tracking-wide">Efectividad</div>
            </div>
            <div className="p-2.5 rounded-xl bg-[var(--secondary)]/40">
              <div className="text-xl font-black text-purple-400">
                {currentStreak > 0 ? `🔥 ${currentStreak}` : '0'}
              </div>
              <div className="text-[11px] text-[var(--muted-foreground)] font-semibold mt-0.5 uppercase tracking-wide">Racha Actual</div>
            </div>
          </div>

          {/* Badges / Insignias */}
          <div className="flex flex-wrap items-center gap-2 mt-4">
            {upsetWins > 0 && (
              <div className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold shadow-sm">
                <span>⚡</span>
                <span>Sorpresa de la jornada ({upsetWins})</span>
              </div>
            )}
            {currentStreak >= 3 && (
              <div className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-orange-500/15 border border-orange-500/30 text-orange-300 text-xs font-bold shadow-sm">
                <span>🔥</span>
                <span>En Racha Ganadora</span>
              </div>
            )}
            {totalPlayed >= 5 && (
              <div className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-300 text-xs font-bold shadow-sm">
                <span>🎖️</span>
                <span>Veterano del Circuito</span>
              </div>
            )}
          </div>
        </div>

        {/* 2. Active Tournament & Next Match Hero */}
        {activeParticipation && (
          <div className="p-6 rounded-2xl bg-gradient-to-br from-blue-950/40 via-[var(--card)] to-purple-950/30 border border-blue-500/30 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
                </span>
                <span className="text-xs font-extrabold uppercase tracking-wider text-blue-400">
                  Torneo en Curso: {(activeParticipation.tournaments as any)?.name}
                </span>
              </div>

              <Link
                href={`/t/${(activeParticipation.tournaments as any)?.slug}`}
                className="text-xs font-bold text-[var(--primary)] hover:underline flex items-center gap-1"
              >
                Ver Cuadro Completo →
              </Link>
            </div>

            {/* Group Position & Progress */}
            {groupPosition !== null && (
              <div className="p-3 rounded-xl bg-[var(--secondary)]/60 flex items-center justify-between text-xs">
                <span className="text-[var(--muted-foreground)]">
                  Grupo {(activeParticipation.tournament_groups as any)?.group_letter ?? 'A'}
                </span>
                <span className="font-extrabold text-white">
                  Posición actual en la tabla: <strong className="text-amber-400">#{groupPosition}</strong> de {totalInGroup ?? 4}
                </span>
              </div>
            )}

            {/* Next Match Card / Dual-check Interactive Component */}
            {nextMatchData ? (
              <PlayerActiveMatchCard match={nextMatchData} currentUserId={profile.id} />
            ) : (
              <div className="p-5 rounded-xl bg-[var(--card)] border border-[var(--border)] text-center text-xs text-[var(--muted-foreground)]">
                ✓ No tienes partidos pendientes en este momento.
              </div>
            )}
          </div>
        )}

        {/* 3. Recent Matches History */}
        <div className="p-6 rounded-2xl bg-[var(--card)] border border-[var(--border)] space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-extrabold text-sm uppercase tracking-wider text-[var(--muted-foreground)]">
              Historial de Partidos ({confirmedMatches.length})
            </h2>
          </div>

          {confirmedMatches.length === 0 ? (
            <div className="text-center py-8 text-sm text-[var(--muted-foreground)]">
              Aún no has disputado ningún partido oficial.
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {confirmedMatches.map((m) => {
                const isP1 = m.player1_id === profile.id;
                const myScore = isP1 ? m.score_player1 : m.score_player2;
                const oppScore = isP1 ? m.score_player2 : m.score_player1;
                const opp = isP1 ? (m.player2 as any) : (m.player1 as any);
                const won = m.winner_id === profile.id;

                return (
                  <div key={m.id} className="py-3.5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${
                        won ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
                      }`}>
                        {won ? 'V' : 'D'}
                      </span>
                      <div>
                        <div className="font-bold text-sm text-white">
                          vs {opp?.nickname || opp?.name || 'Rival'}
                        </div>
                        <div className="text-xs text-[var(--muted-foreground)] capitalize">
                          {(m.tournaments as any)?.name ?? 'Torneo'} • Fase {m.stage}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-mono font-extrabold text-base">
                        <span className={won ? 'text-green-400' : 'text-white'}>{myScore}</span>
                        <span className="text-[var(--muted-foreground)] mx-1">-</span>
                        <span className={!won ? 'text-red-400' : 'text-[var(--muted-foreground)]'}>{oppScore}</span>
                      </div>
                      {m.is_upset && won && (
                        <span className="text-[10px] text-amber-400 font-bold">⚡ Sorpresa</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 4. Tournaments History */}
        <div className="p-6 rounded-2xl bg-[var(--card)] border border-[var(--border)] space-y-4">
          <h2 className="font-extrabold text-sm uppercase tracking-wider text-[var(--muted-foreground)]">
            Torneos Inscritos ({participations?.length ?? 0})
          </h2>

          {(!participations || participations.length === 0) ? (
            <div className="text-center py-8 text-sm text-[var(--muted-foreground)]">
              No estás inscrito en ningún torneo actualmente.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {participations.map((p: any) => {
                const t = p.tournaments;
                return (
                  <Link
                    key={p.tournament_id}
                    href={`/t/${t?.slug}`}
                    className="p-4 rounded-xl bg-[var(--secondary)]/50 border border-[var(--border)] hover:border-[var(--primary)] transition flex flex-col justify-between"
                  >
                    <div>
                      <div className="font-bold text-sm text-white">{t?.name}</div>
                      <div className="text-xs text-[var(--muted-foreground)] capitalize mt-1">
                        Estado: {String(t?.status ?? '').replace('_', ' ')}
                      </div>
                    </div>
                    <div className="mt-3 text-[11px] font-semibold text-[var(--primary)] flex items-center gap-1">
                      Ver Torneo →
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
