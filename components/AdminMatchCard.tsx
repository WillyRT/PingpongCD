'use client';

import { useState } from 'react';
import { verifyMatchScoreAction, reportMatchScoreAction } from '@/lib/actions/matches';
import type { MatchRow, ProfileRow } from '@/lib/types/database';

export interface AdminMatchCardProps {
  match: MatchRow & {
    player1?: ProfileRow | { id: string; name: string };
    player2?: ProfileRow | { id: string; name: string };
  };
  currentUserId?: string;
  onUpdated?: () => void;
}

export function AdminMatchCard({ match, onUpdated }: AdminMatchCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideScore1, setOverrideScore1] = useState<number>(match.score_player1 ?? 7);
  const [overrideScore2, setOverrideScore2] = useState<number>(match.score_player2 ?? 5);

  const p1Name = match.player1?.name || 'Jugador 1';
  const p2Name = match.player2?.name || 'Jugador 2';

  const isConfirmed = match.status === 'confirmed' || match.status === 'completed';
  const isDisputed = match.status === 'disputed';
  const hasScores = match.score_player1 !== null && match.score_player2 !== null;

  const handleQuickValidate = async () => {
    setLoading(true);
    setError(null);

    try {
      // If match has scores, confirm directly. If not, open modal to enter scores first.
      if (!hasScores) {
        setShowOverrideModal(true);
        setLoading(false);
        return;
      }

      const res = await verifyMatchScoreAction({
        matchId: match.id,
        action: 'confirm',
      });

      if (!res.success) {
        setError(res.error || 'Error al validar acta administrativa.');
      } else {
        if (onUpdated) onUpdated();
        else window.location.reload();
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const handleForceOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await verifyMatchScoreAction({
        matchId: match.id,
        action: 'confirm',
        overrideScore1,
        overrideScore2,
      });

      if (!res.success) {
        setError(res.error || 'Error al forzar el resultado.');
      } else {
        setShowOverrideModal(false);
        if (onUpdated) onUpdated();
        else window.location.reload();
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-5 rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-md space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="font-extrabold uppercase tracking-wider text-[var(--primary)]">
            {match.stage.replace('_', ' ')}
          </span>
          {match.is_upset && (
            <span className="px-2 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-400 text-[10px] border border-amber-500/30">
              🔥 Sorpresa
            </span>
          )}
        </div>

        <div>
          {isConfirmed ? (
            <span className="px-2.5 py-0.5 rounded-full font-bold bg-green-500/20 text-green-400 border border-green-500/30">
              ✓ Confirmado
            </span>
          ) : isDisputed ? (
            <span className="px-2.5 py-0.5 rounded-full font-bold bg-red-500/20 text-red-400 border border-red-500/30">
              ⚠️ En Disputa
            </span>
          ) : (
            <span className="px-2.5 py-0.5 rounded-full font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">
              ⏳ {match.status}
            </span>
          )}
        </div>
      </div>

      {/* Players & Current Scores */}
      <div className="p-3 rounded-xl bg-[var(--secondary)]/50 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className={match.winner_id === match.player1_id ? 'font-black text-green-400' : 'text-white font-medium'}>
            {p1Name}
          </span>
          <span className="font-mono font-bold text-base">
            {match.score_player1 ?? '-'}
          </span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className={match.winner_id === match.player2_id ? 'font-black text-green-400' : 'text-white font-medium'}>
            {p2Name}
          </span>
          <span className="font-mono font-bold text-base">
            {match.score_player2 ?? '-'}
          </span>
        </div>
      </div>

      {/* Dispute details if present */}
      {isDisputed && match.dispute_reason && (
        <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300">
          <strong>Motivo de disputa:</strong> {match.dispute_reason}
        </div>
      )}

      {error && (
        <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Admin Action Buttons */}
      <div className="pt-2 border-t border-[var(--border)] flex items-center gap-2">
        {!isConfirmed && (
          <button
            type="button"
            disabled={loading}
            onClick={handleQuickValidate}
            className="flex-1 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            <span>⚡</span>
            <span>{loading ? 'Validando...' : 'Validar / Forzar Acta'}</span>
          </button>
        )}

        <button
          type="button"
          disabled={loading}
          onClick={() => {
            setOverrideScore1(match.score_player1 ?? 7);
            setOverrideScore2(match.score_player2 ?? 5);
            setShowOverrideModal(true);
          }}
          className="py-2.5 px-3 rounded-xl bg-[var(--secondary)] hover:bg-[var(--secondary)]/80 text-white font-semibold text-xs border border-[var(--border)] transition"
        >
          ✏️ Modificar Tanteo
        </button>
      </div>

      {/* Override / Force Score Modal */}
      {showOverrideModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4 animate-scale-up">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h4 className="font-extrabold text-sm text-white">
                Validar / Forzar Acta Administrativa
              </h4>
              <button
                type="button"
                onClick={() => setShowOverrideModal(false)}
                className="text-sm text-[var(--muted-foreground)] hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleForceOverride} className="space-y-4">
              <p className="text-xs text-[var(--muted-foreground)]">
                Como administrador, puedes validar directamente el tanteo. El partido pasará de inmediato al estado <strong>confirmed</strong>, actualizando clasificaciones y ratings Glicko-2 sin requerir confirmación del rival.
              </p>

              <div className="space-y-3 p-3 rounded-xl bg-[var(--secondary)]">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white truncate max-w-[180px]">{p1Name}</span>
                  <input
                    type="number"
                    min="0"
                    max="99"
                    required
                    value={overrideScore1}
                    onChange={(e) => setOverrideScore1(parseInt(e.target.value) || 0)}
                    className="w-16 text-center font-mono font-bold text-lg py-1 px-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-white"
                  />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white truncate max-w-[180px]">{p2Name}</span>
                  <input
                    type="number"
                    min="0"
                    max="99"
                    required
                    value={overrideScore2}
                    onChange={(e) => setOverrideScore2(parseInt(e.target.value) || 0)}
                    className="w-16 text-center font-mono font-bold text-lg py-1 px-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowOverrideModal(false)}
                  className="px-3.5 py-2 rounded-xl bg-[var(--secondary)] text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow disabled:opacity-50"
                >
                  {loading ? 'Confirmando...' : '⚡ Forzar y Confirmar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
