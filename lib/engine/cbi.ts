/**
 * Competitive Balance Index (CBI) for tournament group distribution.
 * Quantifies fairness and symmetry across groups formed by snake seeding.
 */

export interface GroupPlayer {
  id: string;
  rating: number;
}

export interface GroupBalanceStat {
  groupIndex: number;
  groupCode: string;
  playerCount: number;
  meanRating: number;
  totalRating: number;
}

export interface CBIResult {
  cbiPercentage: number;
  symmetryText: string;
  overallMeanRating: number;
  maxDifference: number;
  groupStats: GroupBalanceStat[];
}

/**
 * Calculate Competitive Balance Index (CBI) between groups.
 * 
 * Formula:
 * 1. For each group k, calculate mean rating R_k.
 * 2. Calculate overall mean rating across groups μ.
 * 3. Relative spread = (max(R_k) - min(R_k)) / μ.
 * 4. CBI = clamp(0, 100, round((1 - Relative spread) * 100)).
 * 
 * Example:
 * If Group A mean = 1520 and Group B mean = 1480, μ = 1500:
 * Spread = 40 / 1500 = 0.0267 -> CBI = 97% -> "Equilibrio entre grupos: 97% simétrico".
 */
export function calculateCompetitiveBalanceIndex(
  groups: Array<{ groupIndex: number; groupCode?: string; players: GroupPlayer[] }>
): CBIResult {
  if (groups.length <= 1) {
    const singleGroup = groups[0];
    const mean = singleGroup && singleGroup.players.length > 0
      ? singleGroup.players.reduce((sum, p) => sum + p.rating, 0) / singleGroup.players.length
      : 1500;
    return {
      cbiPercentage: 100,
      symmetryText: 'Equilibrio entre grupos: 100% simétrico (grupo único)',
      overallMeanRating: Math.round(mean * 10) / 10,
      maxDifference: 0,
      groupStats: groups.map((g, idx) => ({
        groupIndex: g.groupIndex ?? idx,
        groupCode: g.groupCode || String.fromCharCode(65 + idx),
        playerCount: g.players.length,
        meanRating: Math.round(mean * 10) / 10,
        totalRating: g.players.reduce((sum, p) => sum + p.rating, 0),
      })),
    };
  }

  const groupStats: GroupBalanceStat[] = groups.map((g, idx) => {
    const count = g.players.length;
    const total = g.players.reduce((sum, p) => sum + p.rating, 0);
    const mean = count > 0 ? total / count : 0;
    return {
      groupIndex: g.groupIndex ?? idx,
      groupCode: g.groupCode || String.fromCharCode(65 + idx),
      playerCount: count,
      meanRating: Math.round(mean * 10) / 10,
      totalRating: total,
    };
  });

  const means = groupStats.map((s) => s.meanRating);
  const minMean = Math.min(...means);
  const maxMean = Math.max(...means);
  const overallMean = means.reduce((sum, m) => sum + m, 0) / means.length;
  const maxDifference = Math.round((maxMean - minMean) * 10) / 10;

  let cbiPercentage = 100;
  if (overallMean > 0) {
    const relativeSpread = (maxMean - minMean) / overallMean;
    cbiPercentage = Math.max(0, Math.min(100, Math.round((1 - relativeSpread) * 100)));
  }

  return {
    cbiPercentage,
    symmetryText: `Equilibrio entre grupos: ${cbiPercentage}% simétrico`,
    overallMeanRating: Math.round(overallMean * 10) / 10,
    maxDifference,
    groupStats,
  };
}
