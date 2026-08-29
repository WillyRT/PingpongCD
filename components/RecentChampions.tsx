import { getRecentChampions } from '@/lib/queries/champions';

export default async function RecentChampions() {
  const champions = await getRecentChampions();
  const firstChamp = champions[0];
  if (!firstChamp) return null;

  const isSingleYear = champions.length === 1;
  const lastChamp = champions[champions.length - 1] ?? firstChamp;

  return (
    <div className="max-w-2xl w-full mx-auto my-6 px-4">
      {isSingleYear ? (
        // Vista 2026 / 2027: Tarjetas destacadas de Vigentes Campeones
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
          <div className="p-4 rounded-2xl bg-surface-card border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-transparent to-transparent shadow-lg shadow-amber-500/5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <span>🏆</span> Campeón Senior (+14)
              </span>
              <span className="text-[10px] font-semibold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full">
                {firstChamp.year}
              </span>
            </div>
            <p className="text-lg font-black text-white">{firstChamp.seniorChampion}</p>
            <p className="text-xs text-amber-200/70 font-medium mt-0.5">🥇 Vigente Campeón</p>
          </div>

          <div className="p-4 rounded-2xl bg-surface-card border border-blue-500/30 bg-gradient-to-br from-blue-500/10 via-transparent to-transparent shadow-lg shadow-blue-500/5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                <span>🏓</span> Campeón Sub-14
              </span>
              <span className="text-[10px] font-semibold text-blue-300 bg-blue-500/20 px-2 py-0.5 rounded-full">
                {firstChamp.year}
              </span>
            </div>
            <p className="text-lg font-black text-white">{firstChamp.sub14Champion}</p>
            <p className="text-xs text-blue-200/70 font-medium mt-0.5">Cantera CD · 🥇 Vigente Campeón</p>
          </div>
        </div>
      ) : (
        // Vista 2028 (2 ediciones) y 2029+ (3 ediciones): Palmarés compacto
        <div className="p-5 rounded-2xl bg-surface-card border border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-surface-card to-blue-500/5 shadow-xl">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-3 mb-3.5">
            <div className="flex items-center gap-2">
              <span className="text-lg">👑</span>
              <h2 className="text-sm font-bold uppercase tracking-wider text-amber-400">
                Palmarés Reciente ({lastChamp.year}–{firstChamp.year})
              </h2>
            </div>
            <span className="text-[10px] font-semibold text-[var(--muted-foreground)] bg-black/40 px-2 py-0.5 rounded-full border border-[var(--border)]">
              Senior / Sub-14
            </span>
          </div>

          <div className="space-y-2.5">
            {champions.map(({ year, seniorChampion, sub14Champion }) => (
              <div
                key={year}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-black/30 border border-white/5 hover:border-amber-500/30 transition-all gap-2 text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="font-black text-amber-300 font-mono text-base">{year}</span>
                  <span className="text-[var(--border)] hidden sm:inline">•</span>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-amber-400 font-semibold text-[11px]">🏆 Senior:</span>
                    <span className="font-bold text-white">{seniorChampion}</span>
                  </div>

                  <span className="text-white/20 hidden sm:inline">/</span>

                  <div className="flex items-center gap-1.5">
                    <span className="text-blue-400 font-semibold text-[11px]">🏓 Sub-14:</span>
                    <span className="font-bold text-white">{sub14Champion}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
