'use client';

import { useState } from 'react';
import { confirmMatchScoreAction, disputeMatchScoreAction } from '@/lib/actions/matches';

export interface PendingValidationMatch {
  id: string;
  tournamentId: string;
  tournamentName: string;
  tournamentSlug?: string;
  stage: string;
  player1Id: string;
  player2Id: string;
  player1Name: string;
  player2Name: string;
  scorePlayer1: number;
  scorePlayer2: number;
  reportedBy: string;
  reportedByName: string;
  status: string;
}

interface PendingMatchValidationsProps {
  matches: PendingValidationMatch[];
  currentUserId: string;
}

export function PendingMatchValidations({
  matches,
  currentUserId,
}: PendingMatchValidationsProps) {
  const [loadingMatchId, setLoadingMatchId] = useState<string | null>(null);
  const [disputeModalMatch, setDisputeModalMatch] = useState<PendingValidationMatch | null>(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filter matches that are waiting for THIS player's confirmation (i.e. caller is the opponent who didn't report)
  const pendingForMe = matches.filter((m) => {
    const isParticipant = m.player1Id === currentUserId || m.player2Id === currentUserId;
    const isReporter = m.reportedBy === currentUserId;
    const isPendingStatus =
      m.status === 'reported' ||
      m.status === 'submitted' ||
      m.status === 'pending_verification';
    return isParticipant && !isReporter && isPendingStatus;
  });

  if (pendingForMe.length === 0) return null;

  const handleConfirm = async (matchId: string) => {
    setLoadingMatchId(matchId);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await confirmMatchScoreAction(matchId);
      if (!res.success) {
        setErrorMessage(res.error || 'Error al confirmar el resultado.');
      } else {
        setSuccessMessage('✓ ¡Resultado convalidado con éxito! El acta ha quedado confirmada.');
        window.location.reload();
      }
    } catch {
      setErrorMessage('Error de conexión al confirmar.');
    } finally {
      setLoadingMatchId(null);
    }
  };

  const handleDisputeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputeModalMatch) return;

    setLoadingMatchId(disputeModalMatch.id);
    setErrorMessage(null);

    try {
      const reason = disputeReason.trim() || 'Desacuerdo con el tanteo reportado por el rival.';
      const res = await disputeMatchScoreAction(disputeModalMatch.id, reason);
      if (!res.success) {
        setErrorMessage(res.error || 'Error al disputar el resultado.');
      } else {
        setDisputeModalMatch(null);
        setDisputeReason('');
        window.location.reload();
      }
    } catch {
      setErrorMessage('Error de conexión al disputar.');
    } finally {
      setLoadingMatchId(null);
    }
  };

  return (
    <div className="space-y-4">
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-semibold">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-2xl bg-green-500/15 border border-green-500/30 text-green-300 text-xs font-bold">
          {successMessage}
        </div>
      )}

      {pendingForMe.map((match) => {
        const isP1 = match.player1Id === currentUserId;
        const myScore = isP1 ? match.scorePlayer1 : match.scorePlayer2;
        const oppScore = isP1 ? match.scorePlayer2 : match.scorePlayer1;
        const oppName = isP1 ? match.player2Name : match.player1Name;
        const scoreDisplay = `${myScore} - ${oppScore}`;

        return (
          <div
            key={match.id}
            className="p-5 md:p-6 rounded-3xl bg-gradient-to-r from-amber-950/40 via-[var(--card)] to-blue-950/30 border-2 border-amber-500/50 shadow-2xl space-y-4 relative overflow-hidden animate-slide-up"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
                </span>
                <span className="text-xs font-black uppercase tracking-wider text-amber-400">
                  Validación de Acta Pendiente
                </span>
              </div>
              <span className="text-[11px] font-semibold text-[var(--muted-foreground)]">
                {match.tournamentName} • Fase: {match.stage}
              </span>
            </div>

            {/* Main Priority Message */}
            <div className="space-y-1">
              <h3 className="text-base md:text-lg font-black text-white">
                Acta reportada por {oppName}: <span className="font-mono text-amber-400">{scoreDisplay}</span>
              </h3>
              <p className="text-xs text-[var(--muted-foreground)]">
                Tu rival ha registrado este resultado oficial. Por favor, verifica el tanteo para convalidar el acta o disputa el marcador si existe alguna discrepancia.
              </p>
            </div>

            {/* Score Comparison Display */}
            <div className="p-3.5 rounded-2xl bg-[var(--secondary)]/60 flex items-center justify-between font-mono">
              <div className="text-xs font-bold text-white">
                Tú ({myScore})
              </div>
              <div className="text-xl font-black text-white">
                {scoreDisplay}
              </div>
              <div className="text-xs font-bold text-[var(--muted-foreground)]">
                {oppName} ({oppScore})
              </div>
            </div>

            {/* Dual Actions: Confirm & Dispute */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
              <button
                type="button"
                disabled={loadingMatchId === match.id}
                onClick={() => handleConfirm(match.id)}
                className="w-full sm:flex-1 py-3 px-5 rounded-xl bg-green-600 hover:bg-green-500 text-white font-extrabold text-xs transition shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span>✓</span>
                <span>{loadingMatchId === match.id ? 'Confirmando...' : 'Confirmar Resultado'}</span>
              </button>

              <button
                type="button"
                disabled={loadingMatchId === match.id}
                onClick={() => {
                  setDisputeModalMatch(match);
                  setDisputeReason('');
                }}
                className="w-full sm:w-auto py-3 px-5 rounded-xl bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/40 font-bold text-xs transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span>✕</span>
                <span>Disputar Marcador</span>
              </button>
            </div>
          </div>
        );
      })}

      {/* Dispute Modal */}
      {disputeModalMatch && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-scale-up">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h4 className="font-extrabold text-sm text-white flex items-center gap-2">
                <span>⚠️</span>
                <span>Disputar Marcador de Partido</span>
              </h4>
              <button
                type="button"
                onClick={() => setDisputeModalMatch(null)}
                className="text-sm text-[var(--muted-foreground)] hover:text-white font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleDisputeSubmit} className="space-y-4">
              <p className="text-xs text-[var(--muted-foreground)]">
                Al disputar este marcador, el partido pasará a estado <strong>En Disputa</strong> y se notificará de inmediato al panel de árbitros para su revisión presencial.
              </p>

              <div>
                <label className="block text-xs font-bold text-[var(--muted-foreground)] uppercase mb-1.5">
                  Motivo de la Discrepancia
                </label>
                <textarea
                  rows={3}
                  required
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  placeholder="Ej. El marcador real fue 11-9 y no 11-7, o el ganador fue otro..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--secondary)] border border-[var(--border)] text-xs text-white focus:outline-none focus:border-[var(--primary)]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDisputeModalMatch(null)}
                  className="px-4 py-2.5 rounded-xl bg-[var(--secondary)] text-xs font-semibold text-[var(--muted-foreground)] hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loadingMatchId === disputeModalMatch.id}
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg disabled:opacity-50"
                >
                  {loadingMatchId === disputeModalMatch.id ? 'Impugnando...' : 'Confirmar Impugnación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
