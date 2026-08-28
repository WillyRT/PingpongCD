'use client';

import type { Standing } from '@/lib/engine/standings';

interface StandingsTableProps {
  standings: Standing[];
  playerNames: Map<string, string>;
  groupCode?: string;
}

export function StandingsTable({
  standings,
  playerNames,
  groupCode,
}: StandingsTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--card)]">
      {groupCode && (
        <div className="px-4 py-3 border-b border-[var(--border)] font-bold text-sm flex items-center justify-between">
          <span>GRUPO {groupCode}</span>
          <span className="text-xs text-[var(--muted-foreground)] font-normal">
            Desempates calculados con ELO dinámico en vivo
          </span>
        </div>
      )}
      <table className="w-full text-sm text-left">
        <thead className="text-xs uppercase bg-[var(--secondary)] text-[var(--muted-foreground)]">
          <tr>
            <th className="px-3 py-2.5 text-center w-8">Pos</th>
            <th className="px-4 py-2.5">Jugador</th>
            <th className="px-2 py-2.5 text-center">PJ</th>
            <th className="px-2 py-2.5 text-center font-bold text-[var(--accent)]">PG</th>
            <th className="px-2 py-2.5 text-center text-red-400">PP</th>
            <th className="px-2 py-2.5 text-center">PF</th>
            <th className="px-2 py-2.5 text-center">PC</th>
            <th className="px-3 py-2.5 text-center font-semibold">DIF</th>
            <th className="px-3 py-2.5 text-center font-bold text-[var(--primary)]">ELO en vivo</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {standings.map((s) => {
            const name = playerNames.get(s.playerId) || s.playerId.slice(0, 8);
            const isTop2 = s.position <= 2;

            return (
              <tr
                key={s.playerId}
                className={`hover:bg-[var(--secondary)]/50 transition-colors ${
                  isTop2 ? 'bg-blue-500/[0.03]' : ''
                }`}
              >
                <td className="px-3 py-3 text-center font-bold text-xs">
                  <span
                    className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${
                      s.position === 1
                        ? 'bg-amber-500/20 text-amber-400'
                        : s.position === 2
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'text-[var(--muted-foreground)]'
                    }`}
                  >
                    {s.position}
                  </span>
                </td>
                <td className="px-4 py-3 font-medium">
                  {name}
                  {s.seed < 99 && (
                    <span className="text-[10px] text-[var(--muted-foreground)] ml-1.5 font-mono">
                      (Seed #{s.seed})
                    </span>
                  )}
                </td>
                <td className="px-2 py-3 text-center">{s.played}</td>
                <td className="px-2 py-3 text-center font-bold text-[var(--accent)]">{s.wins}</td>
                <td className="px-2 py-3 text-center text-red-400">{s.losses}</td>
                <td className="px-2 py-3 text-center">{s.pointsFor}</td>
                <td className="px-2 py-3 text-center">{s.pointsAgainst}</td>
                <td className="px-3 py-3 text-center font-semibold font-mono">
                  {s.pointsDiff > 0 ? `+${s.pointsDiff}` : s.pointsDiff}
                </td>
                <td className="px-3 py-3 text-center font-bold font-mono text-xs text-[var(--primary)]">
                  {s.liveRating ? Math.round(s.liveRating) : 1500}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
