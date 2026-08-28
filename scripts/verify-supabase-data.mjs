import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const secretKey = process.env.SUPABASE_SECRET_KEY || '';

const supabase = createClient(supabaseUrl, secretKey);

async function verify() {
  console.log('=== VERIFYING REAL SUPABASE DATA COUNTS ===');

  const { count: playersCount } = await supabase.from('players').select('*', { count: 'exact', head: true });
  const { count: aliasesCount } = await supabase.from('player_aliases').select('*', { count: 'exact', head: true });
  const { count: tourneysCount } = await supabase.from('historical_tournaments').select('*', { count: 'exact', head: true });
  const { count: groupsCount } = await supabase.from('historical_groups').select('*', { count: 'exact', head: true });
  const { count: matchesCount } = await supabase.from('historical_matches').select('*', { count: 'exact', head: true });
  const { count: completeMatchesCount } = await supabase.from('historical_matches').select('*', { count: 'exact', head: true }).eq('status', 'complete');
  const { count: missingMatchesCount } = await supabase.from('historical_matches').select('*', { count: 'exact', head: true }).eq('status', 'missing');
  const { count: ratingStatesCount } = await supabase.from('rating_states').select('*', { count: 'exact', head: true });
  const { count: snapshotsCount } = await supabase.from('rating_snapshots').select('*', { count: 'exact', head: true });

  console.log('Canonical Players in DB:', playersCount);
  console.log('Player Aliases in DB:', aliasesCount);
  console.log('Historical Tournaments in DB:', tourneysCount);
  console.log('Historical Groups in DB:', groupsCount);
  console.log('Historical Matches Total in DB:', matchesCount);
  console.log('  - Complete matches:', completeMatchesCount);
  console.log('  - Missing matches:', missingMatchesCount);
  console.log('Rating States in DB:', ratingStatesCount);
  console.log('Rating Snapshots in DB:', snapshotsCount);

  // Inspect the missing match specifically
  const { data: missingMatch } = await supabase
    .from('historical_matches')
    .select('*, player1:player1_id(canonical_name), player2:player2_id(canonical_name)')
    .eq('status', 'missing')
    .single();

  console.log('\nMissing Match Verification:');
  console.log('  Status:', missingMatch?.status);
  console.log('  Player 1:', missingMatch?.player1?.canonical_name);
  console.log('  Player 2:', missingMatch?.player2?.canonical_name);
  console.log('  Scores:', `${missingMatch?.score_player1} - ${missingMatch?.score_player2}`);
  console.log('  Winner ID:', missingMatch?.winner_id, '(must be null)');

  // Sample top 5 leaderboard ratings
  const { data: topPlayers } = await supabase
    .from('rating_states')
    .select('rating, rating_deviation, matches_played, player:player_id(canonical_name)')
    .order('rating', { ascending: false })
    .limit(5);

  console.log('\nTop 5 Glicko-2 Rated Players in Remote Supabase:');
  topPlayers?.forEach((p, idx) => {
    console.log(`  ${idx + 1}. ${p.player?.canonical_name}: Rating ${p.rating.toFixed(1)}, RD ${p.rating_deviation.toFixed(1)}, Matches ${p.matches_played}`);
  });
}

verify().catch(console.error);
