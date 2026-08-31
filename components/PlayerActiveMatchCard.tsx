'use client';

import { useState } from 'react';
import {
  reportMatchScoreAction,
  verifyMatchScoreAction,
  confirmMatchScoreAction,
  disputeMatchScoreAction,
} from '@/lib/actions/matches';
import { createClient } from '@/lib/supabase/client';

/**
 * Dynamic score presets according to the tournament match stage:
 * - 'group': 7-point presets ([7,5], [7,4], [7,3], [7,2], [8,6] and reverses)
 * - 'final': 15-point presets ([15,13], [15,12], [15,11], [15,9], [16,14] and reverses)
 * - 'round_of_16' | 'quarterfinal' | 'semifinal': 11-point presets ([11,9], [11,8], [11,7], [11,5], [12,10] and reverses)
 */
export function getScorePresetsForStage(stage?: string | null): [number, number][] {
  const s = stage?.toLowerCase().trim() || 'group';
  if (s === 'group' || s.startsWith('group') || s === 'groups') {
    return [
      [7, 5],
      [7, 4],
      [7, 3],
      [7, 2],
      [8, 6],
      [5, 7],
      [4, 7],
      [3, 7],
      [2, 7],
      [6, 8],
    ];
  }
  if (s === 'final') {
    return [
      [15, 13],
      [15, 12],
      [15, 11],
      [15, 9],
      [16, 14],
      [13, 15],
      [12, 15],
      [11, 15],
      [9, 15],
      [14, 16],
    ];
  }
  // 'round_of_16' | 'quarterfinal' | 'semifinal' or other playoff stages
  return [
    [11, 9],
    [11, 8],
    [11, 7],
    [11, 5],
    [12, 10],
    [9, 11],
    [8, 11],
    [7, 11],
    [5, 11],
    [10, 12],
  ];
}

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
  const stagePresets = getScorePresetsForStage(match.stage);
  const defaultInitialScores = stagePresets[0] || [7, 5];

  const [showReportModal, setShowReportModal] = useState(false);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeEvidenceUrl, setDisputeEvidenceUrl] = useState('');
  const [score1, setScore1] = useState(defaultInitialScores[0]);
  const [score2, setScore2] = useState(defaultInitialScores[1]);
  const [loading, setLoading] = useState(false);
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPlayer1 = match.player1Id === currentUserId;
  const isReporter = match.reportedBy === currentUserId;
  const opponentName = isPlayer1 ? match.player2Name : match.player1Name;
  const opponentRating = isPlayer1 ? match.player2Rating : match.player1Rating;
  const opponentScore = isPlayer1 ? match.scorePlayer2 : match.scorePlayer1;
  const myScore = isPlayer1 ? match.scorePlayer1 : match.scorePlayer2;

  // Strict Canonical Statuses from Migration 010
  const isPendingVerification = match.status === 'pending_verification';
  const isCompleted = match.status === 'completed';
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
      const res = await confirmMatchScoreAction(match.id);

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
      const res = await disputeMatchScoreAction(
        match.id,
        disputeReason.trim() || 'Desacuerdo con el tanteo reportado por el rival.',
        disputeEvidenceUrl.trim() || undefined
      );

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

  const handleUploadEvidence = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingEvidence(true);
    setError(null);
    try {
      const supabase = createClient();
      const fileExt = file.name.split('.').pop() || 'jpg';
      const filePath = `evidence/${match.id}-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('evidence')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        // Fallback: If bucket is restricted or uncreated, generate a data URL so evidence is never lost
        const reader = new FileReader();
        reader.onloadend = () => {
          setDisputeEvidenceUrl(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        const { data: publicData } = supabase.storage.from('evidence').getPublicUrl(filePath);
        setDisputeEvidenceUrl(publicData.publicUrl);
      }
    } catch {
      setError('Error al procesar la foto');
    } finally {
      setUploadingEvidence(false);
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
                {loading ? 'Confirmando...' : '✓ Confirmar Resultado'}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => setShowDisputeModal(true)}
                className="px-4 py-2.5 rounded-xl bg-red-600/20 text-red-300 hover:bg-red-600/30 border border-red-500/30 font-bold text-xs transition"
              >
                ✕ Disputar Marcador
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

      {/* Report Score Modal with Tactile >=64px controls & Common Presets */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[var(--card)] border-2 border-[var(--border)] rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4 animate-scale-up text-left">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div>
                <h4 className="font-black text-base text-[var(--foreground)]">Anotador Rápido de Acta</h4>
                <p className="text-[11px] text-[var(--muted-foreground)]">Diseñado para juego exterior bajo luz solar directa</p>
              </div>
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="w-10 h-10 rounded-xl bg-[var(--secondary)] text-[var(--foreground)] font-black text-lg flex items-center justify-center hover:bg-red-500/20 hover:text-red-400 transition"
              >
                ✕
              </button>
            </div>

            {/* Common Table Tennis Presets */}
            <div>
              <span className="block text-[10px] font-black uppercase tracking-wider text-[var(--muted-foreground)] mb-1.5">
                ⚡ Tanteos Frecuentes (1 toque)
              </span>
              <div className="grid grid-cols-4 gap-1.5">
                {stagePresets.map(([s1, s2]) => (
                  <button
                    key={`${s1}-${s2}`}
                    type="button"
                    onClick={() => {
                      setScore1(s1);
                      setScore2(s2);
                    }}
                    className={`py-2 rounded-xl border text-xs font-black tabular-nums transition ${
                      score1 === s1 && score2 === s2
                        ? 'bg-[var(--primary)] text-white border-black shadow'
                        : 'bg-[var(--secondary)] text-[var(--foreground)] border-[var(--border)] hover:border-[var(--primary)]'
                    }`}
                  >
                    {s1} - {s2}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleReport} className="space-y-4">
              {/* Tactile 64px Height Players Scoring Controls */}
              <div className="space-y-3 p-3 rounded-2xl bg-[var(--secondary)] border-2 border-[var(--border)]">
                {/* Player 1 Row */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 truncate">
                    <span className="text-xs font-black block truncate">{match.player1Name}</span>
                    <span className="text-[10px] text-[var(--muted-foreground)]">Jugador 1</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setScore1((prev) => Math.max(0, prev - 1))}
                      className="min-h-[64px] min-w-[56px] rounded-xl bg-[var(--card)] border-2 border-[var(--border)] text-2xl font-black flex items-center justify-center active:scale-95 transition"
                    >
                      -
                    </button>
                    <span className="min-h-[64px] min-w-[64px] px-2 rounded-xl bg-[var(--card)] border-2 border-[var(--border)] font-black text-3xl tabular-nums flex items-center justify-center">
                      {score1}
                    </span>
                    <button
                      type="button"
                      onClick={() => setScore1((prev) => prev + 1)}
                      className="min-h-[64px] min-w-[56px] rounded-xl bg-[var(--card)] border-2 border-[var(--border)] text-2xl font-black flex items-center justify-center active:scale-95 transition"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Player 2 Row */}
                <div className="flex items-center justify-between gap-3 pt-2 border-t border-[var(--border)]">
                  <div className="flex-1 truncate">
                    <span className="text-xs font-black block truncate">{match.player2Name}</span>
                    <span className="text-[10px] text-[var(--muted-foreground)]">Jugador 2</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setScore2((prev) => Math.max(0, prev - 1))}
                      className="min-h-[64px] min-w-[56px] rounded-xl bg-[var(--card)] border-2 border-[var(--border)] text-2xl font-black flex items-center justify-center active:scale-95 transition"
                    >
                      -
                    </button>
                    <span className="min-h-[64px] min-w-[64px] px-2 rounded-xl bg-[var(--card)] border-2 border-[var(--border)] font-black text-3xl tabular-nums flex items-center justify-center">
                      {score2}
                    </span>
                    <button
                      type="button"
                      onClick={() => setScore2((prev) => prev + 1)}
                      className="min-h-[64px] min-w-[56px] rounded-xl bg-[var(--card)] border-2 border-[var(--border)] text-2xl font-black flex items-center justify-center active:scale-95 transition"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="px-4 py-3 rounded-xl bg-[var(--secondary)] text-xs font-bold border border-[var(--border)]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="min-h-[50px] px-6 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-black shadow-lg hover:opacity-95 disabled:opacity-50 transition flex items-center gap-2"
                >
                  {loading ? 'Enviando...' : '✓ Confirmar y Enviar Acta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dispute Modal with Photo Evidence Option */}
      {showDisputeModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[var(--card)] border-2 border-red-500/40 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4 animate-scale-up text-left">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div>
                <h4 className="font-black text-base text-red-400">Impugnar Marcador</h4>
                <p className="text-[11px] text-[var(--muted-foreground)]">
                  La mesa arbitral examinará las actas y evidencias aportadas
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDisputeModal(false)}
                className="w-10 h-10 rounded-xl bg-[var(--secondary)] text-[var(--foreground)] font-black text-lg flex items-center justify-center hover:bg-red-500/20 hover:text-red-400 transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleDispute} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[var(--foreground)] mb-1">
                  Motivo de la discrepancia:
                </label>
                <textarea
                  rows={3}
                  required
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  placeholder="Ej: El marcador real fue 11-8 a mi favor en el set decisivo."
                  className="w-full p-3 rounded-xl bg-[var(--secondary)] border-2 border-[var(--border)] text-xs text-[var(--foreground)] focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-[var(--foreground)]">
                  📷 Foto o Enlace de Evidencia (opcional):
                </label>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="cursor-pointer px-3 py-2 rounded-xl bg-[var(--secondary)] border-2 border-dashed border-[var(--border)] hover:border-[var(--primary)] text-xs font-bold flex items-center gap-1.5 transition">
                      <span>📸</span>
                      <span>{uploadingEvidence ? 'Subiendo foto...' : 'Subir Foto de Acta'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        disabled={uploadingEvidence}
                        onChange={handleUploadEvidence}
                        className="hidden"
                      />
                    </label>

                    {disputeEvidenceUrl && (
                      <span className="text-[11px] font-bold text-green-400 flex items-center gap-1">
                        ✓ Foto Adjunta
                      </span>
                    )}
                  </div>

                  <input
                    type="url"
                    value={disputeEvidenceUrl}
                    onChange={(e) => setDisputeEvidenceUrl(e.target.value)}
                    placeholder="O pega URL: https://ejemplo.com/foto.jpg"
                    className="w-full p-2.5 rounded-xl bg-[var(--secondary)] border-2 border-[var(--border)] text-xs text-[var(--foreground)] focus:outline-none focus:border-red-500"
                  />
                </div>
                <p className="text-[10px] text-[var(--muted-foreground)]">
                  Sube foto del marcador o papel de acta para mediación inmediata del árbitro.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDisputeModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-[var(--secondary)] text-xs font-bold border border-[var(--border)]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading || !disputeReason.trim()}
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black shadow-lg disabled:opacity-50 transition"
                >
                  {loading ? 'Impugnando...' : '⚠️ Registrar Impugnación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
