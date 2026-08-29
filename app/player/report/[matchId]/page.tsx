import { createClient } from '@/lib/supabase/server';
import { getPlayerSession } from '@/lib/auth/player-session';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ScoreReportClient } from './ScoreReportClient';

interface PageProps {
  params: Promise<{ matchId: string }>;
}

export default async function ReportScorePage({ params }: PageProps) {
  const { matchId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const playerSession = await getPlayerSession();

  const effectiveUserId = user?.id || playerSession?.playerId;
  if (!effectiveUserId) redirect(`/login?redirectTo=/player/report/${matchId}`);

  // Fetch match details
  const { data: match, error } = await supabase
    .from('matches')
    .select('*, player1:player1_id (id, name), player2:player2_id (id, name), tournaments:tournament_id (name, slug)')
    .eq('id', matchId)
    .single();

  if (error || !match) notFound();

  // Verify player is participant
  const isPlayer1 = match.player1_id === effectiveUserId;
  const isPlayer2 = match.player2_id === effectiveUserId;

  if (!isPlayer1 && !isPlayer2) {
    redirect('/player');
  }

  return (
    <main className="min-h-screen pb-20">
      {/* Header */}
      <header className="glass sticky top-0 z-50 px-4 py-3 border-b border-[var(--border)]">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <Link href="/player" className="text-sm font-semibold text-[var(--muted-foreground)] hover:text-white">
            ← Dashboard
          </Link>
          <span className="text-xs font-bold uppercase text-[var(--primary)]">
            {(match.tournaments as any)?.name ?? 'Tournament'}
          </span>
        </div>
      </header>

      <div className="max-w-md mx-auto px-4 py-8">
        <ScoreReportClient
          match={match}
          currentUserId={effectiveUserId}
          isPlayer1={isPlayer1}
        />
      </div>
    </main>
  );
}
