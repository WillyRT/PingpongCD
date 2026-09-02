import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getPlayerSession } from '@/lib/auth/player-session';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { calculateWinProbability } from '@/lib/engine/analytics';
import { calculateStandings } from '@/lib/engine/standings';
import { getCategoryLabel } from '@/lib/engine/categories';
import { PlayerActiveMatchCard } from '@/components/PlayerActiveMatchCard';
import { PendingMatchValidations, type PendingValidationMatch } from '@/components/PendingMatchValidations';
import { PlayerProfileView, type MatchDetailItem } from '@/components/PlayerProfileView';
import { ParticipantCheckInCard } from '@/components/ParticipantCheckInCard';
import { isSuperAdminProfile, isApprovedStaff } from '@/lib/auth/roles';
import type { AgeCategory } from '@/lib/types/domain';

export default async function PlayerPortalPage() {
  const supabase = await createClient();
  const admin = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  const playerSession = await getPlayerSession();

  if (!user && !playerSession) {
    redirect('/login?redirectTo=/me');
  }

  let profile: any = null;

  // 1. Try finding profile by authenticated Supabase Auth user email
  if (user?.email) {
    const { data: pByEmail } = await admin
      .from('profiles')
      .select('*')
      .eq('email', user.email.toLowerCase())
      .maybeSingle();
    if (pByEmail) profile = pByEmail;
  }

  // 2. Try finding profile by targetPlayerId
  const targetPlayerId = user?.id || playerSession?.playerId;
  if (!profile && targetPlayerId) {
    const { data: pById } = await admin
      .from('profiles')
      .select('*')
      .or(`id.eq.${targetPlayerId},user_id.eq.${targetPlayerId}`)
      .maybeSingle();
    if (pById) profile = pById;
  }

  // 3. Try finding profile by player session email
  if (!profile && playerSession?.email) {
    const { data: pBySessionEmail } = await admin
      .from('profiles')
      .select('*')
      .eq('email', playerSession.email.toLowerCase())
      .maybeSingle();
    if (pBySessionEmail) profile = pBySessionEmail;
  }

  // 4. Auto-provision profile if user is authenticated via Supabase Auth
  if (!profile && user?.email) {
    const userEmail = user.email.toLowerCase();
    const isSuperAdmin = isSuperAdminProfile({ email: userEmail, role: undefined });
    const fallbackName = user.user_metadata?.name || userEmail.split('@')[0];
    const newProfile = {
      id: user.id,
      name: fallbackName,
      nickname: fallbackName,
      email: userEmail,
      role: isSuperAdmin ? 'super_admin' : 'player',
      admin_status: isSuperAdmin ? 'approved' : 'none',
      category: 'plus14',
      rating: 1500,
      rating_deviation: 350,
      volatility: 0.06,
      matches_played: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await admin.from('profiles').upsert(newProfile, { onConflict: 'id' });
    profile = newProfile;
  }

  if (!profile) {
    redirect('/login?redirectTo=/me');
  }

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
      tournaments:tournament_id (id, name, slug, status),
      tournament_groups:group_id (id, group_code)
    `)
    .or(`player1_id.eq.${profile.id},player2_id.eq.${profile.id}`)
    .order('created_at', { ascending: false });

  // Fetch rating snapshots
  const { data: rawSnapshots } = await admin
    .from('rating_snapshots')
    .select('*')
    .eq('player_id', profile.id)
    .order('created_at', { ascending: true });

  const formattedMatches: MatchDetailItem[] = (allMatches || []).map((m: any) => ({
    id: m.id,
    tournament_id: m.tournament_id,
    tournament_name: m.tournaments?.name ?? 'Torneo Oficial',
    tournament_slug: m.tournaments?.slug,
    stage: m.stage,
    group_code: m.tournament_groups?.group_code ?? null,
    player1_id: m.player1_id,
    player2_id: m.player2_id,
    score_player1: m.score_player1,
    score_player2: m.score_player2,
    winner_id: m.winner_id,
    is_upset: m.is_upset,
    created_at: m.created_at,
    player1: m.player1,
    player2: m.player2,
  }));

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
      m.status === 'scheduled' ||
      m.status === 'in_progress' ||
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

  // Filter matches awaiting confirmation from the current user (Dual-check pending validations)
  const pendingValidations: PendingValidationMatch[] = (allMatches || [])
    .filter((m: any) => {
      const reporterId = m.reported_by_id || m.reported_by;
      const isReporter = reporterId === profile.id;
      return m.status === 'pending_verification' && !isReporter;
    })
    .map((m: any) => {
      const isP1 = m.player1_id === profile.id;
      const reporterId = m.reported_by_id || m.reported_by;
      const reporterName =
        reporterId === m.player1_id
          ? m.player1?.nickname || m.player1?.name || 'Jugador 1'
          : m.player2?.nickname || m.player2?.name || 'Jugador 2';

      return {
        id: m.id,
        tournamentId: m.tournament_id,
        tournamentName: m.tournaments?.name ?? 'Torneo Oficial',
        tournamentSlug: m.tournaments?.slug,
        stage: m.stage,
        player1Id: m.player1_id,
        player2Id: m.player2_id,
        player1Name: m.player1?.nickname || m.player1?.name || 'Jugador 1',
        player2Name: m.player2?.nickname || m.player2?.name || 'Jugador 2',
        scorePlayer1: m.score_player1 ?? 0,
        scorePlayer2: m.score_player2 ?? 0,
        reportedBy: reporterId || '',
        reportedByName: reporterName,
        status: m.status,
      };
    });

  const isStaff =
    isSuperAdminProfile({ email: user?.email || profile.email, role: profile.role }) ||
    isApprovedStaff(profile);

  // 🚨 High Priority "¡A PISTA!" Alert: Match on physical table (1 to 4) ready or in progress
  const callingMatch = (allMatches || []).find((m: any) => {
    const hasTable = typeof m.table_number === 'number' && m.table_number >= 1 && m.table_number <= 4;
    return hasTable && (m.status === 'scheduled' || m.status === 'in_progress');
  });

  const callingMatchRivalName = callingMatch
    ? (callingMatch.player1_id === profile.id
        ? (callingMatch.player2?.nickname || callingMatch.player2?.name || 'Rival')
        : (callingMatch.player1?.nickname || callingMatch.player1?.name || 'Rival'))
    : null;

  // Pending Check-in for active/upcoming tournaments
  const checkInPendingParticipation = (participations || []).find((p: any) => {
    const t = p.tournaments;
    if (!t) return false;
    const isPreDraw = t.status === 'registration' || t.status === 'draft';
    const isCheckedIn = !!p.checked_in_at;
    const isClosed = t.check_in_closes_at && new Date() > new Date(t.check_in_closes_at);
    return isPreDraw && !isCheckedIn && !isClosed;
  });

  return (
    <main className="min-h-screen pb-24 bg-[var(--background)] text-[var(--foreground)] px-4 py-6 md:py-10">
      <div className="max-w-5xl mx-auto space-y-6 animate-slide-up">
        {/* 🚨 Priority Banner: ¡A PISTA! Mesa X vs Rival */}
        {callingMatch && (
          <div className="p-4 sm:p-5 rounded-2xl bg-amber-400 text-black border-4 border-black shadow-[0_6px_0_0_#000000] animate-pulse flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-3xl sm:text-4xl animate-bounce">🚨</span>
              <div>
                <h2 className="text-lg sm:text-xl font-black uppercase tracking-tight text-black">
                  🚨 ¡A PISTA! MESA {callingMatch.table_number}: vs {callingMatchRivalName} — Acude a calentar
                </h2>
                <p className="text-xs sm:text-sm font-bold text-black/80">
                  Tu partido ha sido llamado a pista oficial. Acude de inmediato a calentar.
                </p>
              </div>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              <Link
                href="/tables"
                className="px-4 py-2.5 rounded-xl bg-black text-white text-xs font-black uppercase tracking-wider hover:bg-neutral-800 transition shadow"
              >
                Ver Monitor 4 Mesas →
              </Link>
            </div>
          </div>
        )}

        {/* Priority Check-in Confirmation Card */}
        {checkInPendingParticipation && (
          <ParticipantCheckInCard
            tournamentId={checkInPendingParticipation.tournament_id}
            tournamentName={(checkInPendingParticipation.tournaments as any)?.name || 'Torneo Oficial'}
            checkInClosesAt={(checkInPendingParticipation.tournaments as any)?.check_in_closes_at}
            initialCheckedInAt={checkInPendingParticipation.checked_in_at}
          />
        )}

        {/* Priority Banner: Pending Match Validations (Dual-Check) */}
        {pendingValidations.length > 0 && (
          <PendingMatchValidations matches={pendingValidations} currentUserId={profile.id} />
        )}

        {/* Staff Quick Access Banner */}
        {isStaff && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
              <span>🛡️</span>
              <span>Acceso de Administración / Arbitraje Habilitado</span>
            </div>
            <Link
              href="/admin"
              className="px-3 py-1.5 rounded-lg bg-amber-500 text-black text-xs font-black hover:bg-amber-400 transition"
            >
              Ir a Panel Admin →
            </Link>
          </div>
        )}

        {/* Active Match Card / Dual-check Interactive Component */}
        {nextMatchData && (
          <div className="p-6 rounded-2xl bg-gradient-to-br from-blue-950/40 via-[var(--card)] to-purple-950/30 border border-blue-500/30 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
                </span>
                <span className="text-xs font-extrabold uppercase tracking-wider text-blue-400">
                  Partido Pendiente en Curso: {nextMatchData.tournamentName}
                </span>
              </div>
            </div>

            <PlayerActiveMatchCard match={nextMatchData} currentUserId={profile.id} />
          </div>
        )}

        {/* Unified Rich Player Profile View */}
        <PlayerProfileView
          profile={profile}
          matches={formattedMatches}
          snapshots={rawSnapshots ?? []}
          participations={participations ?? []}
          isOwnProfile={true}
        />
      </div>
    </main>
  );
}
