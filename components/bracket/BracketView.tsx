'use client';

import type { BracketMatchView } from '@/lib/types/domain';

interface BracketViewProps {
  matches: BracketMatchView[];
  totalRounds: number;
}

export function BracketView({ matches, totalRounds }: BracketViewProps) {
  // Group matches by round
  const roundsMap = new Map<number, BracketMatchView[]>();
  for (let r = 1; r <= totalRounds; r++) {
    roundsMap.set(r, []);
  }

  for (const m of matches) {
    roundsMap.get(m.round)?.push(m);
  }

  const roundNames: Record<number, string> = {
    1: totalRounds === 3 ? 'Quarterfinals' : totalRounds === 2 ? 'Semifinals' : 'Round 1',
    2: totalRounds === 3 ? 'Semifinals' : 'Final',
    3: 'Final',
  };

  return (
    <div className="overflow-x-auto pb-6">
      <div className="flex gap-8 min-w-max px-2 py-4">
        {Array.from(roundsMap.entries()).map(([round, roundMatches]) => {
          const title = roundNames[round] || `Round ${round}`;

          return (
            <div key={round} className="flex flex-col min-w-[260px] max-w-[280px]">
              {/* Round Title */}
              <div className="text-center pb-4 mb-2 border-b border-[var(--border)]">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--primary)]">
                  {title}
                </span>
              </div>

              {/* Matches list aligned vertically */}
              <div className="flex flex-col justify-around flex-1 gap-6 py-2">
                {roundMatches.map((m) => (
                  <div
                    key={m.id}
                    className="p-3.5 rounded-xl bg-[var(--card)] border border-[var(--border)] shadow-sm space-y-2 relative"
                  >
                    {/* Player 1 */}
                    <div
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-sm ${
                        m.winner?.id === m.player1?.id
                          ? 'bg-[var(--accent)]/10 text-[var(--accent)] font-bold'
                          : ''
                      }`}
                    >
                      <span className="truncate pr-2">{m.player1?.name || 'TBD'}</span>
                      {m.score1 !== null && (
                        <span className="font-mono font-bold">{m.score1}</span>
                      )}
                    </div>

                    {/* Divider */}
                    <div className="border-t border-[var(--border)]/60" />

                    {/* Player 2 */}
                    <div
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-sm ${
                        m.winner?.id === m.player2?.id
                          ? 'bg-[var(--accent)]/10 text-[var(--accent)] font-bold'
                          : ''
                      }`}
                    >
                      <span className="truncate pr-2">{m.player2?.name || 'TBD'}</span>
                      {m.score2 !== null && (
                        <span className="font-mono font-bold">{m.score2}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
