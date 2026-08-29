import { createAdminClient } from '@/lib/supabase/server';

export interface YearChampions {
  year: number;
  seniorChampion: string;
  sub14Champion: string;
}

// Edición base oficial 2026
const BASE_2026: YearChampions = {
  year: 2026,
  seniorChampion: 'Juan Pedro González (Jeipi)',
  sub14Champion: 'Pablo Cascón',
};

export async function getRecentChampions(): Promise<YearChampions[]> {
  try {
    const supabase = createAdminClient();

    // Consultar torneos completados a partir de 2027 en la tabla tournaments
    const { data: liveTournaments } = await supabase
      .from('tournaments')
      .select(`
        id,
        name,
        slug,
        status,
        created_at,
        matches (
          stage,
          category,
          status,
          winner_id,
          player1_id,
          player2_id,
          player1:profiles!matches_player1_id_fkey(name),
          player2:profiles!matches_player2_id_fkey(name)
        )
      `)
      .in('status', ['finished', 'completed'])
      .order('created_at', { ascending: false });

    const modernYearsMap = new Map<number, { senior?: string; sub14?: string }>();

    if (liveTournaments) {
      for (const t of liveTournaments) {
        const year = new Date(t.created_at).getFullYear();
        if (year <= 2026) continue; // 2026 se toma del registro base oficial

        const finalMatch = (t.matches as any[])?.find(
          (m: any) => m.stage === 'final' && (m.status === 'confirmed' || m.status === 'completed')
        );

        if (finalMatch?.winner_id) {
          const championName =
            finalMatch.winner_id === finalMatch.player1_id
              ? finalMatch.player1?.name
              : finalMatch.player2?.name;

          if (championName) {
            const current = modernYearsMap.get(year) || {};
            const isSub14 =
              t.name.toLowerCase().includes('sub') ||
              t.slug?.toLowerCase().includes('sub') ||
              finalMatch.category === 'sub14';

            if (isSub14) {
              current.sub14 = championName;
            } else {
              current.senior = championName;
            }
            modernYearsMap.set(year, current);
          }
        }
      }
    }

    const list: YearChampions[] = [];

    // 1. Añadir años futuros completados (2027, 2028, 2029...)
    for (const [year, champs] of modernYearsMap.entries()) {
      list.push({
        year,
        seniorChampion: champs.senior || 'Por determinar',
        sub14Champion: champs.sub14 || 'Por determinar',
      });
    }

    // 2. Añadir la base 2026
    list.push(BASE_2026);

    // 3. Ordenar descendentemente y limitar a los 3 más recientes
    return list.sort((a, b) => b.year - a.year).slice(0, 3);
  } catch (err) {
    console.error('Error al obtener campeones recientes:', err);
    return [BASE_2026];
  }
}
