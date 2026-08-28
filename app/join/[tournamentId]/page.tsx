import { createClient } from '@/lib/supabase/server';
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

  let tournament = null;

  // a) Primero por id (si el parámetro tiene formato UUID)
  if (UUID_REGEX.test(decodedParam)) {
    const { data } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', decodedParam)
      .maybeSingle();
    tournament = data;
  }

  // b) Si no lo encuentra o no es UUID, por la columna slug
  if (!tournament) {
    // 1. Intento por slug exacto decodificado
    const { data: bySlug } = await supabase
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

      const { data: byNormSlug } = await supabase
        .from('tournaments')
        .select('*')
        .eq('slug', normalizedSlug)
        .maybeSingle();
      tournament = byNormSlug;
    }

    // 3. Intento case-insensitive
    if (!tournament) {
      const { data: byIlike } = await supabase
        .from('tournaments')
        .select('*')
        .ilike('slug', decodedParam)
        .maybeSingle();
      tournament = byIlike;
    }
  }

  if (!tournament) notFound();

  // Fetch participant count
  const { count: participantCount } = await supabase
    .from('tournament_participants')
    .select('*', { count: 'exact', head: true })
    .eq('tournament_id', tournament.id);

  // Check if current authenticated user
  const { data: { user } } = await supabase.auth.getUser();
  let existingProfile = null;
  if (user) {
    const { data: prof } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    existingProfile = prof;
  }

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-8 flex flex-col items-center justify-center">
      <PublicJoinClient
        tournament={tournament}
        participantCount={participantCount ?? 0}
        currentUser={user ? { id: user.id, email: user.email ?? '' } : null}
        existingProfile={existingProfile}
      />
    </main>
  );
}
