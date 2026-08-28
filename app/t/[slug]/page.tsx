import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function TournamentLanding({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('*')
    .eq('slug', slug)
    .single();

  if (!tournament) notFound();

  // Count participants
  const { count: participantCount } = await supabase
    .from('tournament_participants')
    .select('*', { count: 'exact', head: true })
    .eq('tournament_id', tournament.id);

  // Check if current user is already registered
  const { data: { user } } = await supabase.auth.getUser();
  let isRegistered = false;
  if (user) {
    const { data: participation } = await supabase
      .from('tournament_participants')
      .select('user_id')
      .eq('tournament_id', tournament.id)
      .eq('user_id', user.id)
      .single();
    isRegistered = !!participation;
  }

  const statusInfo: Record<string, { label: string; color: string; icon: string }> = {
    draft: { label: 'Coming Soon', color: 'text-gray-400', icon: '📋' },
    registration: { label: 'Registration Open', color: 'text-green-400', icon: '✅' },
    group_stage: { label: 'Group Stage', color: 'text-amber-400', icon: '⚔️' },
    bracket_stage: { label: 'Knockout Stage', color: 'text-purple-400', icon: '🏆' },
    finished: { label: 'Completed', color: 'text-blue-400', icon: '🎉' },
  };

  const status = statusInfo[tournament.status] ?? statusInfo.draft!;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
      <div className="max-w-md w-full text-center animate-slide-up">
        {/* Tournament Icon */}
        <div className="text-6xl mb-6">{status.icon}</div>

        {/* Tournament Name */}
        <h1 className="text-3xl font-extrabold mb-2">{tournament.name}</h1>

        {/* Status Badge */}
        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--secondary)] ${status.color} text-sm font-medium mb-6`}>
          <span className="w-2 h-2 rounded-full bg-current" />
          {status.label}
        </div>

        {/* Info */}
        <div className="p-6 rounded-xl bg-[var(--card)] border border-[var(--border)] mb-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-2xl font-bold">{participantCount ?? 0}</div>
              <div className="text-xs text-[var(--muted-foreground)] mt-1">Players</div>
            </div>
            <div>
              <div className="text-2xl font-bold">🏓</div>
              <div className="text-xs text-[var(--muted-foreground)] mt-1">Table Tennis</div>
            </div>
          </div>
        </div>

        {/* Actions */}
        {tournament.status === 'registration' && !isRegistered && (
          <div className="space-y-3">
            <Link
              href={`/join/${slug}`}
              className="block w-full px-6 py-4 rounded-xl gradient-primary text-white font-semibold text-lg text-center transition-transform hover:scale-105 active:scale-95 shadow-lg"
            >
              🏓 Inscribirse al Torneo
            </Link>
            {!user && (
              <Link
                href={`/login?redirectTo=/t/${slug}`}
                className="block text-xs text-[var(--muted-foreground)] hover:text-white text-center underline"
              >
                ¿Ya tienes cuenta? Inicia sesión aquí
              </Link>
            )}
          </div>
        )}

        {isRegistered && (
          <div className="p-4 rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/20">
            <p className="text-[var(--accent)] font-medium">✓ You're registered!</p>
            <Link
              href="/player"
              className="inline-block mt-3 text-sm text-[var(--primary)] hover:underline"
            >
              Go to Dashboard →
            </Link>
          </div>
        )}

        {tournament.status === 'draft' && (
          <p className="text-[var(--muted-foreground)]">
            Registration hasn't opened yet. Check back soon!
          </p>
        )}

        {(tournament.status === 'group_stage' || tournament.status === 'bracket_stage') && (
          <div className="space-y-3">
            <p className="text-[var(--muted-foreground)]">
              Tournament is in progress.
            </p>
            {user && isRegistered && (
              <Link
                href="/player"
                className="inline-block px-6 py-3 rounded-xl gradient-primary text-white font-semibold"
              >
                Go to Dashboard
              </Link>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
