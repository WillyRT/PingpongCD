'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { MatchRow, ProfileRow } from '@/lib/types/database';
import { ScoreInput } from '@/components/matches/ScoreInput';
import { reportScoreAction, confirmMatchAction, disputeMatchAction } from '@/lib/actions/matches';

interface ScoreReportClientProps {
  match: MatchRow & {
    player1?: ProfileRow;
    player2?: ProfileRow;
  };
  currentUserId: string;
  isPlayer1: boolean;
}

export function ScoreReportClient({ match, currentUserId, isPlayer1 }: ScoreReportClientProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isReporter = match.reported_by === currentUserId;
  const p1Name = match.player1?.name || (isPlayer1 ? 'You' : 'Player 1');
  const p2Name = match.player2?.name || (!isPlayer1 ? 'You' : 'Player 2');

  const handleReport = async (score1: number, score2: number) => {
    setLoading(true);
    setError(null);
    const res = await reportScoreAction({
      matchId: match.id,
      scorePlayer1: score1,
      scorePlayer2: score2,
    });

    if (!res.success) {
      setError(res.error || 'Failed to submit score');
      setLoading(false);
    } else {
      router.refresh();
    }
  };

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    const res = await confirmMatchAction(match.id);
    if (!res.success) setError(res.error || 'Failed to confirm');
    else router.push('/player');
    setLoading(false);
  };

  const handleDispute = async () => {
    setLoading(true);
    setError(null);
    const res = await disputeMatchAction(match.id, 'Score disputed by opponent');
    if (!res.success) setError(res.error || 'Failed to file dispute');
    else router.push('/player');
    setLoading(false);
  };

  // State 1: Completed / Confirmed
  if (match.status === 'completed' || match.status === 'confirmed') {
    return (
      <div className="p-8 rounded-2xl bg-[var(--card)] border border-[var(--border)] text-center space-y-4 animate-slide-up">
        <div className="text-5xl">🏆</div>
        <h2 className="text-xl font-bold">Match Confirmed!</h2>
        <div className="text-3xl font-extrabold tracking-wider my-2">
          {match.score_player1} — {match.score_player2}
        </div>
        <p className="text-sm text-[var(--muted-foreground)]">
          Ratings and tournament standings have been updated.
        </p>
        <Link
          href="/player"
          className="inline-block px-6 py-3 rounded-xl gradient-primary text-white font-semibold text-sm"
        >
          Return to Dashboard
        </Link>
      </div>
    );
  }

  // State 2: Submitted by current user (waiting for opponent)
  if (match.status === 'submitted' && isReporter) {
    return (
      <div className="p-8 rounded-2xl bg-[var(--card)] border border-[var(--border)] text-center space-y-4 animate-slide-up">
        <div className="text-5xl animate-bounce">⏳</div>
        <h2 className="text-xl font-bold">Score Submitted</h2>
        <div className="text-3xl font-extrabold tracking-wider my-2">
          {match.score_player1} — {match.score_player2}
        </div>
        <p className="text-sm text-[var(--muted-foreground)]">
          Waiting for your opponent to confirm or correct the score.
        </p>
        <Link
          href="/player"
          className="inline-block px-6 py-3 rounded-xl bg-[var(--secondary)] border border-[var(--border)] text-sm font-semibold hover:border-[var(--primary)]"
        >
          Back to Dashboard
        </Link>
      </div>
    );
  }

  // State 3: Submitted by opponent (need confirmation from current user)
  if (match.status === 'submitted' && !isReporter) {
    const oppReportedMyScore = isPlayer1 ? match.score_player1 : match.score_player2;
    const oppReportedTheirScore = isPlayer1 ? match.score_player2 : match.score_player1;
    const iLost = (oppReportedMyScore ?? 0) < (oppReportedTheirScore ?? 0);

    return (
      <div className="p-8 rounded-2xl bg-[var(--card)] border border-[var(--border)] text-center space-y-6 animate-slide-up">
        <div className="text-5xl">🏓</div>
        <div>
          <h2 className="text-xl font-bold">Confirm Match Result</h2>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Your opponent reported the following final score:
          </p>
        </div>

        <div className="p-6 rounded-xl bg-[var(--secondary)] border border-[var(--border)]">
          <div className="text-3xl font-extrabold tracking-wider mb-2">
            <span>{match.score_player1}</span>
            <span className="text-[var(--muted-foreground)] mx-2">—</span>
            <span>{match.score_player2}</span>
          </div>
          <p className="text-sm text-[var(--muted-foreground)]">
            {iLost
              ? `Did you lose ${oppReportedMyScore}–${oppReportedTheirScore} against ${isPlayer1 ? p2Name : p1Name}?`
              : `Did you win ${oppReportedMyScore}–${oppReportedTheirScore} against ${isPlayer1 ? p2Name : p1Name}?`}
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-[var(--destructive)]/10 text-[var(--destructive)] text-xs">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={handleDispute}
            className="flex-1 py-3.5 rounded-xl bg-[var(--destructive)]/20 text-[var(--destructive)] font-semibold text-sm disabled:opacity-50"
          >
            Corregir (Dispute)
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={handleConfirm}
            className="flex-1 py-3.5 rounded-xl gradient-accent text-white font-semibold text-sm disabled:opacity-50"
          >
            {loading ? 'Confirming...' : '✓ Aceptar (Confirm)'}
          </button>
        </div>
      </div>
    );
  }

  // State 4: Disputed
  if (match.status === 'disputed') {
    return (
      <div className="p-8 rounded-2xl bg-[var(--card)] border border-red-500/30 text-center space-y-4 animate-slide-up">
        <div className="text-5xl">⚠️</div>
        <h2 className="text-xl font-bold text-red-400">Match Disputed</h2>
        <p className="text-sm text-[var(--muted-foreground)]">
          An administrator is reviewing this score. Standings will update once resolved.
        </p>
        <Link
          href="/player"
          className="inline-block px-6 py-3 rounded-xl bg-[var(--secondary)] border border-[var(--border)] text-sm font-semibold"
        >
          Return to Dashboard
        </Link>
      </div>
    );
  }

  // State 5: Pending score entry
  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 rounded-lg bg-[var(--destructive)]/10 text-[var(--destructive)] text-sm text-center">
          {error}
        </div>
      )}
      <ScoreInput
        player1Name={p1Name}
        player2Name={p2Name}
        stage={match.stage as any}
        isPlayer1={isPlayer1}
        onSubmit={handleReport}
        loading={loading}
      />
    </div>
  );
}
