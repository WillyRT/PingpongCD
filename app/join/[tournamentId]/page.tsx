import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getPlayerSession } from '@/lib/auth/player-session';
import { notFound } from 'next/navigation';
import { PublicJoinClient } from './PublicJoinClient';

interface PageProps {
  params: Promise<{ tournamentId: string }>;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function PublicJoinPage({ params }: PageProps) {
  const { tournamentId } = await params;
  const decodedParam = decodeURIComponent(tournamentId).trim();
  const supabase = await createClient();
  const admin = createAdminClient();

  let tournament = null;

  // a) Primero por id (si el parámetro tiene formato UUID)
  if (UUID_REGEX.test(decodedParam)) {
    const { data } = await admin
      .from('tournaments')
      .select('*')
      .eq('id', decodedParam)
      .maybeSingle();
    tournament = data;
  }

  // b) Si no lo encuentra o no es UUID, por la columna slug
  if (!tournament) {
    // 1. Intento por slug exacto decodificado
    const { data: bySlug } = await admin
      .from('tournaments')
      .select('*')
      .eq('slug', decodedParam)
      .maybeSingle();
    tournament = bySlug;

    // 2. Intento por slug normalizado (minúsculas, guiones, sin acentos)
    if (!tournament) {
      const normalizedSlug = decodedParam
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

      const { data: byNormSlug } = await admin
        .from('tournaments')
        .select('*')
        .eq('slug', normalizedSlug)
        .maybeSingle();
      tournament = byNormSlug;
    }

    // 3. Intento case-insensitive
    if (!tournament) {
      const { data: byIlike } = await admin
        .from('tournaments')
        .select('*')
        .ilike('slug', decodedParam)
        .maybeSingle();
      tournament = byIlike;
    }
  }

  if (!tournament) notFound();

  // Fetch participant count
  const { count: participantCount } = await admin
    .from('tournament_participants')
    .select('*', { count: 'exact', head: true })
    .eq('tournament_id', tournament.id);

  // Check if current authenticated user via Supabase Auth OR player session cookie
  const { data: { user } } = await supabase.auth.getUser();
  const playerSession = await getPlayerSession();

  let profile: any = null;

  // 1. Buscar por email de Supabase Auth
  if (user?.email) {
    const { data: pByEmail } = await admin
      .from('profiles')
      .select('*')
      .eq('email', user.email.toLowerCase())
      .maybeSingle();
    if (pByEmail) profile = pByEmail;
  }

  // 2. Buscar por ID de usuario o de sesión
  const targetId = user?.id || playerSession?.playerId;
  if (!profile && targetId) {
    const { data: pById } = await admin
      .from('profiles')
      .select('*')
      .or(`id.eq.${targetId},user_id.eq.${targetId}`)
      .maybeSingle();
    if (pById) profile = pById;
  }

  // 3. Buscar por email de sesión de jugador
  if (!profile && playerSession?.email) {
    const { data: pBySessionEmail } = await admin
      .from('profiles')
      .select('*')
      .eq('email', playerSession.email.toLowerCase())
      .maybeSingle();
    if (pBySessionEmail) profile = pBySessionEmail;
  }

  // Check if already registered in this tournament
  let isAlreadyRegistered = false;
  if (profile) {
    const { data: part } = await admin
      .from('tournament_participants')
      .select('id')
      .eq('tournament_id', tournament.id)
      .eq('user_id', profile.id)
      .maybeSingle();
    if (part) isAlreadyRegistered = true;
  }

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-8 flex flex-col items-center justify-center">
      <PublicJoinClient
        tournament={tournament}
        participantCount={participantCount ?? 0}
        currentUser={
          user
            ? { id: user.id, email: user.email ?? '' }
            : playerSession
            ? { id: playerSession.playerId, email: playerSession.email }
            : null
        }
        existingProfile={profile}
        isAlreadyRegistered={isAlreadyRegistered}
      />
    </main>
  );
}
