'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function useRealtimeMatches<T extends { id: string; tournament_id?: string }>(
  tournamentId: string,
  initialMatches: T[]
): T[] {
  const [matches, setMatches] = useState<T[]>(initialMatches);

  useEffect(() => {
    setMatches(initialMatches);
  }, [initialMatches]);

  useEffect(() => {
    if (!tournamentId) return;
    const supabase = createClient();

    const channel = supabase
      .channel(`realtime-matches-${tournamentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches',
          filter: `tournament_id=eq.${tournamentId}`,
        },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            const updated = payload.new as any;
            setMatches((prev) =>
              prev.map((m) =>
                m.id === updated.id
                  ? {
                      ...m,
                      ...updated,
                      player1: (m as any).player1 ?? (updated as any).player1,
                      player2: (m as any).player2 ?? (updated as any).player2,
                    }
                  : m
              )
            );
          } else if (payload.eventType === 'INSERT') {
            const inserted = payload.new as any;
            setMatches((prev) => {
              if (prev.some((m) => m.id === inserted.id)) return prev;
              return [...prev, inserted];
            });
          } else if (payload.eventType === 'DELETE') {
            const deleted = payload.old as any;
            setMatches((prev) => prev.filter((m) => m.id !== deleted.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tournamentId]);

  return matches;
}
