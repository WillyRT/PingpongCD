'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { TournamentRow } from '@/lib/types/database';
import type { RealtimeChannel } from '@supabase/supabase-js';

export function useRealtimeTournament(
  tournamentId: string,
  initialTournament: TournamentRow
) {
  const [tournament, setTournament] = useState<TournamentRow>(initialTournament);
  const supabase = createClient();

  const handleChange = useCallback(
    (payload: { new: TournamentRow }) => {
      setTournament(payload.new);
    },
    []
  );

  useEffect(() => {
    let channel: RealtimeChannel;

    const setupSubscription = () => {
      channel = supabase
        .channel(`tournament:${tournamentId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'tournaments',
            filter: `id=eq.${tournamentId}`,
          },
          (payload) => handleChange(payload as unknown as { new: TournamentRow })
        )
        .subscribe();
    };

    setupSubscription();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [tournamentId, supabase, handleChange]);

  return { tournament, setTournament };
}
