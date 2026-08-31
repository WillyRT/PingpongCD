'use client';

import { useState } from 'react';
import { checkInParticipantAction } from '@/lib/actions/tournament';

interface ParticipantCheckInCardProps {
  tournamentId: string;
  tournamentName: string;
  checkInClosesAt?: string | null;
  initialCheckedInAt?: string | null;
}

export function ParticipantCheckInCard({
  tournamentId,
  tournamentName,
  checkInClosesAt,
  initialCheckedInAt,
}: ParticipantCheckInCardProps) {
  const [checkedInAt, setCheckedInAt] = useState<string | null>(initialCheckedInAt || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheckIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await checkInParticipantAction(tournamentId);
      if (!res.success) {
        setError(res.error || 'Error al confirmar asistencia');
      } else {
        setCheckedInAt(res.data?.checkedInAt || new Date().toISOString());
      }
    } catch {
      setError('Error de conexion al realizar check-in');
    } finally {
      setLoading(false);
    }
  };

  if (checkedInAt) {
    return (
      <div className="p-4 rounded-2xl bg-emerald-500/15 border-2 border-emerald-500/40 text-emerald-300 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">✅</span>
          <div>
            <span className="text-xs font-black block text-emerald-200">Asistencia Confirmada (Check-in OK)</span>
            <span className="text-[11px] text-emerald-400">
              Estas confirmado para el sorteo de grupos de <strong>{tournamentName}</strong>.
            </span>
          </div>
        </div>
        <span className="text-[10px] font-mono px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-200 font-bold">
          {new Date(checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    );
  }

  return (
    <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-900/30 via-[var(--card)] to-amber-900/20 border-2 border-amber-500/40 shadow-md space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="text-2xl">📋</span>
          <div>
            <h3 className="text-sm font-black text-[var(--foreground)]">
              Confirmacion de Asistencia — {tournamentName}
            </h3>
            <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
              Confirma tu presencia fisica en las pistas para entrar en el sorteo de grupos.
              {checkInClosesAt && (
                <span className="block text-amber-400 font-bold text-[11px] mt-0.5">
                  Cierre de check-in: {new Date(checkInClosesAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={handleCheckIn}
          className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-black text-xs uppercase tracking-wider shadow-md transition disabled:opacity-50 shrink-0"
        >
          {loading ? 'Confirmando...' : '✓ Confirmar Asistencia'}
        </button>
      </div>

      {error && (
        <div className="p-2.5 rounded-xl bg-red-500/20 border border-red-500/30 text-red-300 text-xs font-semibold">
          {error}
        </div>
      )}
    </div>
  );
}
