'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { MatchRow, ProfileRow } from '@/lib/types/database';
import { confirmMatchAction, disputeMatchAction } from '@/lib/actions/matches';

interface MatchCardProps {
  match: MatchRow & {
    player1?: ProfileRow;
    player2?: ProfileRow;
  };
  currentUserId: string;
  isAdmin?: boolean;
}

export function MatchCard({ match, currentUserId, isAdmin = false }: MatchCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPlayer1 = match.player1_id === currentUserId;
  const isPlayer2 = match.player2_id === currentUserId;
  const isParticipant = isPlayer1 || isPlayer2;
  const isReporter = match.reported_by === currentUserId;

  const p1Name = match.player1?.name || (isPlayer1 ? 'You' : 'Player 1');
  const p2Name = match.player2?.name || (isPlayer2 ? 'You' : 'Player 2');

  const statusBadges: Record<string, { label: string; bg: string }> = {
    pending: { label: 'Pending', bg: 'bg-gray-500/20 text-gray-400' },
    submitted: { label: 'Awaiting Confirmation', bg: 'bg-amber-500/20 text-amber-400' },
    confirmed: { label: 'Confirmed', bg: 'bg-green-500/20 text-green-400' },
    disputed: { label: 'Disputed', bg: 'bg-red-500/20 text-red-400' },
  };

  const badge = statusBadges[match.status] ?? statusBadges.pending!;

  const hasWinExpectancy = match.win_expectancy_p1 !== null && match.win_expectancy_p2 !== null;
  const pct1 = Math.round((match.win_expectancy_p1 ?? 0.5) * 100);
  const pct2 = Math.round((match.win_expectancy_p2 ?? 0.5) * 100);

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    const res = await confirmMatchAction(match.id);
    if (!res.success) setError(res.error || 'Failed to confirm');
    setLoading(false);
  };

  const handleDispute = async () => {
    setLoading(true);
    setError(null);
    const res = await disputeMatchAction(match.id, 'Disputed by player');
    if (!res.success) setError(res.error || 'Failed to dispute');
    setLoading(false);
  };

  return (
    <div className="p-4 rounded-xl bg-[var(--card)] border border-[var(--border)] space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
            {match.stage.replace('_', ' ')}
          </span>
          {match.is_upset && (
            <span className="px-2 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-400 text-[10px] flex items-center gap-1 border border-amber-500/30">
              🔥 Sorpresa de la jornada
            </span>
          )}
        </div>
        <span className={`px-2.5 py-0.5 rounded-full font-medium ${badge.bg}`}>
          {badge.label}
        </span>
      </div>

      {/* Players & Scores */}
      <div className="flex items-center justify-between">
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between pr-4">
            <div className="flex items-center gap-2">
              <span className={`font-medium ${match.winner_id === match.player1_id ? 'text-[var(--accent)] font-bold' : ''}`}>
                {p1Name}
              </span>
              {hasWinExpectancy && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-[var(--secondary)] text-[var(--muted-foreground)]">
                  {pct1}%
                </span>
              )}
            </div>
            {match.score_player1 !== null && (
              <span className="font-mono text-lg font-bold">
                {match.score_player1}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between pr-4">
            <div className="flex items-center gap-2">
              <span className={`font-medium ${match.winner_id === match.player2_id ? 'text-[var(--accent)] font-bold' : ''}`}>
                {p2Name}
              </span>
              {hasWinExpectancy && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-[var(--secondary)] text-[var(--muted-foreground)]">
                  {pct2}%
                </span>
              )}
            </div>
            {match.score_player2 !== null && (
              <span className="font-mono text-lg font-bold">
                {match.score_player2}
              </span>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="text-xs text-[var(--destructive)] bg-[var(--destructive)]/10 p-2 rounded-lg">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="pt-2 border-t border-[var(--border)] flex flex-wrap gap-2">
        {/* Admin Override */}
        {isAdmin && match.status !== 'confirmed' && (
          <button
            type="button"
            disabled={loading}
            onClick={handleConfirm}
            className="w-full py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow transition flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <span>⚡</span>
            <span>{loading ? 'Validando...' : 'Validar / Forzar Acta'}</span>
          </button>
        )}

        {match.status === 'pending' && isParticipant && !isAdmin && (
          <Link
            href={`/player/report/${match.id}`}
            className="w-full py-2 rounded-lg gradient-primary text-white text-xs font-semibold text-center transition hover:scale-[1.01]"
          >
            Enter Score
          </Link>
        )}

        {(match.status === 'submitted' || match.status === 'reported' || match.status === 'pending_verification') && isParticipant && !isReporter && !isAdmin && (
          <>
            <button
              type="button"
              disabled={loading}
              onClick={handleConfirm}
              className="flex-1 py-2 rounded-lg gradient-accent text-white text-xs font-semibold disabled:opacity-50"
            >
              {loading ? '...' : '✓ Confirm'}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={handleDispute}
              className="flex-1 py-2 rounded-lg bg-[var(--destructive)]/20 text-[var(--destructive)] text-xs font-semibold disabled:opacity-50"
            >
              Corregir (Dispute)
            </button>
          </>
        )}

        {(match.status === 'submitted' || match.status === 'reported' || match.status === 'pending_verification') && isReporter && !isAdmin && (
          <div className="w-full py-1.5 text-center text-xs text-[var(--muted-foreground)]">
            Waiting for opponent confirmation...
          </div>
        )}
      </div>
    </div>
  );
}
