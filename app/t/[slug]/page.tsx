import { createAdminClient, createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { calculateStandings } from '@/lib/engine/standings';
import { getPlayerSession } from '@/lib/auth/player-session';
import {
  TournamentViewClient,
  type GroupData,
  type KnockoutMatchItem,
} from './TournamentViewClient';

interface PageProps {
  params: Promise<{ slug: string }>;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function TournamentLanding({ params }: PageProps) {
  const { slug } = await params;
  const decodedParam = decodeURIComponent(slug).trim();
  const supabase = await createClient();
  const admin = createAdminClient();

  let tournament = null;

  if (UUID_REGEX.test(decodedParam)) {
    const { data } = await admin
      .from('tournaments')
      .select('*')
      .eq('id', decodedParam)
      .maybeSingle();
    tournament = data;
  }

  if (!tournament) {
    const { data: bySlug } = await admin
      .from('tournaments')
      .select('*')
      .eq('slug', decodedParam)
      .maybeSingle();
    tournament = bySlug;

    if (!tournament) {
      const normalizedSlug = decodedParam
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

      const { data: byNorm } = await admin
        .from('tournaments')
        .select('*')
        .eq('slug', normalizedSlug)
        .maybeSingle();
      tournament = byNorm;
    }
  }

  if (!tournament) notFound();

  // Fetch groups
  const { data: rawGroups } = await admin
    .from('tournament_groups')
    .select('*')
    .eq('tournament_id', tournament.id)
    .order('group_code', { ascending: true });

  // Fetch participants with profile
  const { data: participants } = await admin
    .from('tournament_participants')
    .select('*, profiles:user_id (*)')
    .eq('tournament_id', tournament.id);

  // Fetch matches
  const { data: rawMatches } = await admin
    .from('matches')
    .select(`
      *,
      player1:player1_id (id, name, nickname, rating, category),
      player2:player2_id (id, name, nickname, rating, category)
    `)
    .eq('tournament_id', tournament.id)
    .order('created_at', { ascending: true });

  // Fetch rating snapshots for this tournament
  const { data: snapshots } = await admin
    .from('rating_snapshots')
    .select('*')
    .eq('historical_tournament_id', tournament.id);

  // User session check
  const { data: { user } } = await supabase.auth.getUser();
  const playerSession = await getPlayerSession();

  const userIdsToCheck = new Set<string>();
  if (user?.id) userIdsToCheck.add(user.id);
  if (playerSession?.playerId) userIdsToCheck.add(playerSession.playerId);

  const isRegistered = (participants || []).some(
    (p) => userIdsToCheck.has(p.user_id) || (user?.email && p.profiles?.email === user.email)
  );

  // Map of profiles by ID
  const profilesMap = new Map<string, any>();
  for (const p of participants || []) {
    if (p.profiles) {
      profilesMap.set(p.user_id, p.profiles);
    }
  }
  for (const m of rawMatches || []) {
    if (m.player1) profilesMap.set(m.player1_id, m.player1);
    if (m.player2) profilesMap.set(m.player2_id, m.player2);
  }

  // Calculate Standings for Each Group
  const groupsData: GroupData[] = [];
  const groupsList = rawGroups || [];

  for (const g of groupsList) {
    const groupMatches = (rawMatches || []).filter(
      (m) => m.group_id === g.id && m.stage === 'group'
    );

    // Identify players in this group
    const playerIdsSet = new Set<string>();
    for (const p of participants || []) {
      if (p.group_id === g.id) playerIdsSet.add(p.user_id);
    }
    for (const m of groupMatches) {
      if (m.player1_id) playerIdsSet.add(m.player1_id);
      if (m.player2_id) playerIdsSet.add(m.player2_id);
    }

    const playerIds = Array.from(playerIdsSet);

    // Confirmed matches formatted for standing calculation
    const confirmedMatches = groupMatches
      .filter((m) => m.score_player1 !== null && m.score_player2 !== null)
      .map((m) => ({
        player1Id: m.player1_id,
        player2Id: m.player2_id,
        score1: m.score_player1 ?? 0,
        score2: m.score_player2 ?? 0,
        winnerId: m.winner_id ?? (m.score_player1! > m.score_player2! ? m.player1_id : m.player2_id),
      }));

    const seedsMap = new Map<string, number>();
    const initialRatings = new Map<string, number>();

    playerIds.forEach((pid, idx) => {
      seedsMap.set(pid, idx + 1);
      const sn = (snapshots || []).find((s) => s.player_id === pid);
      const prof = profilesMap.get(pid);
      initialRatings.set(pid, sn?.rating_before ?? prof?.rating ?? 1500);
    });

    const calculated = calculateStandings(
      playerIds,
      confirmedMatches,
      seedsMap,
      initialRatings
    );

    const standings = calculated.map((s) => {
      const prof = profilesMap.get(s.playerId);
      const sn = (snapshots || []).find((snap) => snap.player_id === s.playerId);
      return {
        ...s,
        playerName: prof?.nickname || prof?.name || 'Jugador',
        playerCategory: prof?.category || 'plus14',
        finalRating: sn ? Math.round(sn.rating_after) : Math.round(prof?.rating ?? 1500),
      };
    });

    const groupMatchItems = groupMatches.map((m) => {
      const p1 = profilesMap.get(m.player1_id);
      const p2 = profilesMap.get(m.player2_id);
      return {
        id: m.id,
        group_id: m.group_id,
        stage: m.stage,
        player1_id: m.player1_id,
        player2_id: m.player2_id,
        score_player1: m.score_player1,
        score_player2: m.score_player2,
        winner_id: m.winner_id,
        status: m.status,
        player1Name: p1?.nickname || p1?.name || 'Jugador 1',
        player2Name: p2?.nickname || p2?.name || 'Jugador 2',
      };
    });

    groupsData.push({
      id: g.id,
      group_code: g.group_code,
      category: g.category,
      standings,
      matches: groupMatchItems,
    });
  }

  // Knockout Matches
  const knockoutMatches: KnockoutMatchItem[] = (rawMatches || [])
    .filter((m) => m.stage !== 'group')
    .map((m) => {
      const p1 = profilesMap.get(m.player1_id);
      const p2 = profilesMap.get(m.player2_id);
      return {
        id: m.id,
        stage: m.stage,
        player1_id: m.player1_id,
        player2_id: m.player2_id,
        score_player1: m.score_player1,
        score_player2: m.score_player2,
        winner_id: m.winner_id,
        status: m.status,
        player1Name: p1?.nickname || p1?.name || 'Jugador 1',
        player2Name: p2?.nickname || p2?.name || 'Jugador 2',
      };
    });

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-8 md:py-12">
      <TournamentViewClient
        tournament={tournament}
        groups={groupsData}
        knockoutMatches={knockoutMatches}
        totalPlayers={participants?.length || profilesMap.size}
        totalMatches={rawMatches?.length || 0}
        isRegistered={isRegistered}
        userLoggedIn={Boolean(user || playerSession)}
      />
    </main>
  );
}
