'use client';

import { useState } from 'react';
import { reportMatchScoreAction, verifyMatchScoreAction } from '@/lib/actions/matches';

interface PlayerActiveMatchCardProps {
  match: {
    id: string;
    tournamentId: string;
    tournamentName: string;
    stage: string;
    tableNumber?: number | null;
    player1Id: string;
    player2Id: string;
    player1Name: string;
    player2Name: string;
    player1Rating: number;
    player2Rating: number;
    scorePlayer1: number | null;
    scorePlayer2: number | null;
    status: string;
    reportedBy: string | null;
    winExpectancy: number | null;
  };
  currentUserId: string;
}

export function PlayerActiveMatchCard({ match, currentUserId }: PlayerActiveMatchCardProps) {
  const [showReportModal, setShowReportModal] = useState(false);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [score1, setScore1] = useState(7);
  const [score2, setScore2] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPlayer1 = match.player1Id === currentUserId;
  const isReporter = match.reportedBy === currentUserId;
  const opponentName = isPlayer1 ? match.player2Name : match.player1Name;
  const opponentRating = isPlayer1 ? match.player2Rating : match.player1Rating;
  const opponentScore = isPlayer1 ? match.scorePlayer2 : match.scorePlayer1;
  const myScore = isPlayer1 ? match.scorePlayer1 : match.scorePlayer2;

  const isPendingVerification = match.status === 'pending_verification' || match.status === 'submitted';
  const isCompleted = match.status === 'confirmed' || match.status === 'completed';
  const isDisputed = match.status === 'disputed';

  const handleReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await reportMatchScoreAction({
        matchId: match.id,
        scorePlayer1: score1,
        scorePlayer2: score2,
      });

      if (!res.success) {
        setError(res.error || 'Error al reportar el tanteo');
      } else {
        setShowReportModal(false);
        window.location.reload();
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await verifyMatchScoreAction({
        matchId: match.id,
        action: 'confirm',
      });

      if (!res.success) {
        setError(res.error || 'Error confirmando resultado');
      } else {
        window.location.reload();
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const handleDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await verifyMatchScoreAction({
        matchId: match.id,
        action: 'dispute',
        disputeReason: disputeReason.trim() || 'Desacuerdo con el tanteo reportado por el rival.',
      });

      if (!res.success) {
        setError(res.error || 'Error impugnando resultado');
      } else {
        setShowDisputeModal(false);
        window.location.reload();
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-lg space-y-4">
      {/* Header with Table Number */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border)]">
        <div>
          <span className="text-[10px] font-black uppercase tracking-wider text-[var(--primary)] block">
            {match.tournamentName} • Fase: {match.stage}
          </span>
          <h3 className="font-extrabold text-base text-white">Próximo Partido Oficial</h3>
        </div>

        <div className="flex items-center gap-2">
          {match.tableNumber ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs font-bold shadow-sm">
              <span>🏓</span>
              <span>Mesa {match.tableNumber}</span>
            </div>
          ) : (
            <div className="text-[11px] text-[var(--muted-foreground)] px-2.5 py-1 rounded-xl bg-[var(--secondary)]">
              Mesa pendiente de asignación
            </div>
          )}

          {match.winExpectancy !== null && (
            <div className="px-2.5 py-1 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[11px] font-bold">
              Expectancy: {Math.round(match.winExpectancy * 100)}%
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Opponent Info */}
      <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--secondary)]/60">
        <div>
          <span className="text-[10px] text-[var(--muted-foreground)] uppercase font-semibold block">Tu Rival</span>
          <span className="font-bold text-sm sm:text-base text-white block">{opponentName}</span>
          <span className="text-xs text-[var(--muted-foreground)] font-mono">Rating: {opponentRating} pts</span>
        </div>

        {/* Live Status Indicators */}
        <div className="text-right">
          {isCompleted ? (
            <span className="px-3 py-1 rounded-lg bg-green-500/20 text-green-400 text-xs font-bold border border-green-500/30">
              Completado ({match.scorePlayer1} - {match.scorePlayer2})
            </span>
          ) : isDisputed ? (
            <span className="px-3 py-1 rounded-lg bg-red-500/20 text-red-400 text-xs font-bold border border-red-500/30">
              ⚠️ En Disputa
            </span>
          ) : isPendingVerification ? (
            isReporter ? (
              <span className="px-3 py-1 rounded-lg bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/30">
                ⏳ Esperando al rival ({match.scorePlayer1} - {match.scorePlayer2})
              </span>
            ) : (
              <span className="px-3 py-1 rounded-lg bg-blue-500/20 text-blue-300 text-xs font-bold border border-blue-500/30">
                📢 Rival reportó: {match.scorePlayer1} - {match.scorePlayer2}
              </span>
            )
          ) : (
            <span className="px-3 py-1 rounded-lg bg-gray-500/20 text-gray-300 text-xs font-medium">
              Por Jugar
            </span>
          )}
        </div>
      </div>

      {/* Interactive Action Controls */}
      <div className="pt-2">
        {!isCompleted && !isDisputed && !isPendingVerification && (
          <button
            type="button"
            onClick={() => setShowReportModal(true)}
            className="w-full py-3 rounded-xl gradient-primary text-white font-bold text-xs shadow-md hover:opacity-95 transition"
          >
            🏓 Reportar Marcador
          </button>
        )}

        {isPendingVerification && !isReporter && (
          <div className="space-y-2">
            <div className="p-3 rounded-xl bg-blue-500/15 border border-blue-500/30 text-xs text-blue-300">
              Tu rival ha registrado el resultado provisional: <strong>{myScore}</strong> (tú) - <strong>{opponentScore}</strong> ({opponentName}).
              Verifica si es correcto para convalidar el acta o impugna si discrepas.
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={handleConfirm}
                className="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-xs transition shadow"
              >
                {loading ? 'Confirmando...' : '✅ Confirmar Marcador'}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => setShowDisputeModal(true)}
                className="px-4 py-2.5 rounded-xl bg-red-600/20 text-red-300 hover:bg-red-600/30 border border-red-500/30 font-bold text-xs transition"
              >
                ⚠️ Impugnar
              </button>
            </div>
          </div>
        )}

        {isPendingVerification && isReporter && (
          <div className="text-center text-xs text-[var(--muted-foreground)] p-2">
            Marcador enviado. Esperando a que <strong>{opponentName}</strong> confirme en su portal.
          </div>
        )}

        {isDisputed && (
          <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-xs text-red-300 text-center">
            Este partido está siendo mediado por la mesa de árbitro del torneo.
          </div>
        )}
      </div>

      {/* Report Score Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4 animate-scale-up">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h4 className="font-extrabold text-sm text-white">Anotar Resultado de Partido</h4>
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="text-[var(--muted-foreground)] hover:text-white font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleReport} className="space-y-4">
              <div className="space-y-3 p-3 rounded-xl bg-[var(--secondary)]">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold">{match.player1Name}</span>
                  <input
                    type="number"
                    min="0"
                    max="99"
                    required
                    value={score1}
                    onChange={(e) => setScore1(parseInt(e.target.value) || 0)}
                    className="w-16 text-center font-mono font-bold text-lg py-1 px-2 rounded-lg bg-[var(--card)] border border-[var(--border)]"
                  />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold">{match.player2Name}</span>
                  <input
                    type="number"
                    min="0"
                    max="99"
                    required
                    value={score2}
                    onChange={(e) => setScore2(parseInt(e.target.value) || 0)}
                    className="w-16 text-center font-mono font-bold text-lg py-1 px-2 rounded-lg bg-[var(--card)] border border-[var(--border)]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="px-3.5 py-2 rounded-xl bg-[var(--secondary)] text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-xl gradient-primary text-white text-xs font-bold shadow hover:opacity-90 disabled:opacity-50"
                >
                  {loading ? 'Enviando...' : 'Enviar Marcador'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dispute Modal */}
      {showDisputeModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--card)] border border-red-500/30 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4 animate-scale-up">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h4 className="font-extrabold text-sm text-red-400">Impugnar Marcador</h4>
              <button
                type="button"
                onClick={() => setShowDisputeModal(false)}
                className="text-[var(--muted-foreground)] hover:text-white font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleDispute} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[var(--muted-foreground)] mb-1">
                  Motivo de la impugnación
                </label>
                <textarea
                  rows={3}
                  required
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  placeholder="Ej: El tanteo real fue 7-5 a mi favor, no 5-7."
                  className="w-full p-2.5 rounded-xl bg-[var(--secondary)] border border-[var(--border)] text-xs focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDisputeModal(false)}
                  className="px-3.5 py-2 rounded-xl bg-[var(--secondary)] text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading || !disputeReason.trim()}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow disabled:opacity-50"
                >
                  {loading ? 'Enviando...' : 'Confirmar Impugnación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
