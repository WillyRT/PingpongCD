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
    scheduled: { label: '⏳ CALENTANDO', bg: 'bg-amber-500/20 text-amber-500 border border-amber-500/40' },
    in_progress: { label: '🟢 EN PISTA', bg: 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/40' },
    pending_verification: { label: '🟡 PENDIENTE CONFIRMACIÓN', bg: 'bg-amber-500/20 text-amber-500 border border-amber-500/40' },
    completed: { label: '🟢 FINALIZADO', bg: 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/40' },
    disputed: { label: '🔴 EN DISPUTA', bg: 'bg-red-500/20 text-red-500 border border-red-500/40' },
    walkover: { label: '⚪ W.O.', bg: 'bg-neutral-500/20 text-neutral-400 border border-neutral-500/30' },
  };

  const badge = statusBadges[match.status] ?? { label: '⏳ CALENTANDO', bg: 'bg-amber-500/20 text-amber-500 border border-amber-500/40' };

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
    <div className="p-4 rounded-2xl bg-[var(--card)] border border-[var(--border)] space-y-3 shadow-sm hover:border-[var(--border)]/80 transition-all flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between text-xs pb-1 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <span className="font-extrabold uppercase tracking-wider text-[var(--muted-foreground)]">
            {match.stage.replace('_', ' ')}
          </span>
          {match.is_upset && (
            <span className="px-2 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-500 text-[10px] flex items-center gap-1 border border-amber-500/30">
              🔥 Sorpresa de la jornada
            </span>
          )}
        </div>
        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${badge.bg}`}>
          {badge.label}
        </span>
      </div>

      {/* Players & Large Tabular Scores */}
      <div className="space-y-2 py-1">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <span className={`block truncate text-sm ${match.winner_id === match.player1_id ? 'font-black text-blue-500' : 'font-bold text-[var(--foreground)]'}`}>
              {p1Name}
            </span>
          </div>
          {match.score_player1 !== null ? (
            <span className="font-black text-2xl tabular-nums px-2 py-0.5 rounded-lg bg-[var(--secondary)] border border-[var(--border)]">
              {match.score_player1}
            </span>
          ) : (
            <span className="text-xs text-[var(--muted-foreground)] font-bold">—</span>
          )}
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <span className={`block truncate text-sm ${match.winner_id === match.player2_id ? 'font-black text-blue-500' : 'font-bold text-[var(--foreground)]'}`}>
              {p2Name}
            </span>
          </div>
          {match.score_player2 !== null ? (
            <span className="font-black text-2xl tabular-nums px-2 py-0.5 rounded-lg bg-[var(--secondary)] border border-[var(--border)]">
              {match.score_player2}
            </span>
          ) : (
            <span className="text-xs text-[var(--muted-foreground)] font-bold">—</span>
          )}
        </div>
      </div>

      {/* Fine Bradley-Terry Win Expectancy Bar at the base */}
      {hasWinExpectancy && (
        <div className="space-y-1 pt-1">
          <div className="flex justify-between text-[10px] font-mono font-bold text-[var(--muted-foreground)] tabular-nums">
            <span>{pct1}% probabilidad</span>
            <span>{pct2}% probabilidad</span>
          </div>
          <div className="h-1.5 w-full bg-[var(--secondary)] rounded-full overflow-hidden flex">
            <div
              style={{ width: `${pct1}%` }}
              className="bg-blue-600 h-full transition-all duration-500"
              title={`${p1Name}: ${pct1}%`}
            />
            <div
              style={{ width: `${pct2}%` }}
              className="bg-indigo-500 h-full transition-all duration-500"
              title={`${p2Name}: ${pct2}%`}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="text-xs text-[var(--destructive)] bg-[var(--destructive)]/10 p-2 rounded-lg font-bold">
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

        {match.status === 'pending_verification' && isParticipant && !isReporter && !isAdmin && (
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

        {match.status === 'pending_verification' && isReporter && !isAdmin && (
          <div className="w-full py-1.5 text-center text-xs text-[var(--muted-foreground)]">
            Waiting for opponent confirmation...
          </div>
        )}
      </div>
    </div>
  );
}
