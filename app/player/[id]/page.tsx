import { createAdminClient, createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { PlayerProfileView, type MatchDetailItem } from '@/components/PlayerProfileView';
import { getPlayerSession } from '@/lib/auth/player-session';

interface PageProps {
  params: Promise<{ id: string }>;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function PublicPlayerProfilePage({ params }: PageProps) {
  const { id } = await params;
  const decodedId = decodeURIComponent(id).trim();
  const admin = createAdminClient();
  const supabase = await createClient();

  let profile: any = null;

  if (UUID_REGEX.test(decodedId)) {
    const { data } = await admin
      .from('profiles')
      .select('*')
      .or(`id.eq.${decodedId},user_id.eq.${decodedId}`)
      .maybeSingle();
    profile = data;
  }

  if (!profile) {
    const cleanName = decodedId.replace(/-/g, ' ');
    const { data } = await admin
      .from('profiles')
      .select('*')
      .or(`name.ilike.%${cleanName}%,nickname.ilike.%${cleanName}%`)
      .maybeSingle();
    profile = data;
  }

  if (!profile) notFound();

  // Current user check for isOwnProfile and isAdmin
  const { data: { user } } = await supabase.auth.getUser();
  const playerSession = await getPlayerSession();
  const isOwnProfile = Boolean(
    (user && (user.id === profile.id || user.email?.toLowerCase() === profile.email?.toLowerCase())) ||
    (playerSession && (playerSession.playerId === profile.id || playerSession.email?.toLowerCase() === profile.email?.toLowerCase()))
  );

  let isAdmin = false;
  const viewerEmail = user?.email || playerSession?.email;
  if (viewerEmail) {
    const cleanViewerEmail = viewerEmail.toLowerCase().trim();
    const { data: viewerProfile } = await admin
      .from('profiles')
      .select('role, admin_status')
      .eq('email', cleanViewerEmail)
      .maybeSingle();

    isAdmin =
      cleanViewerEmail === 'guillermoriveraterriza@gmail.com' ||
      viewerProfile?.role === 'super_admin' ||
      (viewerProfile?.role === 'admin' && viewerProfile?.admin_status === 'approved');
  }

  // Fetch all matches involving this player
  const { data: rawMatches } = await admin
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

  const matches: MatchDetailItem[] = (rawMatches || []).map((m: any) => ({
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

  // Fetch rating snapshots
  const { data: rawSnapshots } = await admin
    .from('rating_snapshots')
    .select('*')
    .eq('player_id', profile.id)
    .order('created_at', { ascending: true });

  // Fetch participations
  const { data: participations } = await admin
    .from('tournament_participants')
    .select(`
      *,
      tournaments:tournament_id (*)
    `)
    .eq('user_id', profile.id);

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-8 md:py-12">
      <PlayerProfileView
        profile={profile}
        matches={matches}
        snapshots={rawSnapshots ?? []}
        participations={participations ?? []}
        isOwnProfile={isOwnProfile}
        isAdmin={isAdmin}
      />
    </main>
  );
}
