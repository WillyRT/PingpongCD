'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { MatchRow } from '@/lib/types/database';
import type { RealtimeChannel } from '@supabase/supabase-js';

export function useRealtimeMatches(
  tournamentId: string,
  initialMatches: MatchRow[]
) {
  const [matches, setMatches] = useState<MatchRow[]>(initialMatches);
  const supabase = createClient();

  const handleMatchChange = useCallback(
    (payload: { eventType: string; new: MatchRow; old: Partial<MatchRow> }) => {
      setMatches((prev) => {
        if (payload.eventType === 'INSERT') {
          // Avoid duplicates
          if (prev.some((m) => m.id === payload.new.id)) return prev;
          return [...prev, payload.new];
        }
        if (payload.eventType === 'UPDATE') {
          return prev.map((m) =>
            m.id === payload.new.id ? payload.new : m
          );
        }
        if (payload.eventType === 'DELETE') {
          return prev.filter((m) => m.id !== payload.old.id);
        }
        return prev;
      });
    },
    []
  );

  useEffect(() => {
    let channel: RealtimeChannel;

    const setupSubscription = () => {
      channel = supabase
        .channel(`matches:${tournamentId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'matches',
            filter: `tournament_id=eq.${tournamentId}`,
          },
          (payload) => handleMatchChange(payload as unknown as {
            eventType: string;
            new: MatchRow;
            old: Partial<MatchRow>;
          })
        )
        .subscribe();
    };

    setupSubscription();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [tournamentId, supabase, handleMatchChange]);

  return { matches, setMatches };
}
