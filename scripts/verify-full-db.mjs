import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

const TABLES = [
  'profiles',
  'tournaments',
  'tournament_config',
  'tournament_groups',
  'tournament_participants',
  'matches',
  'match_reports',
  'audit_logs',
  'players',
  'player_aliases',
  'historical_imports',
  'historical_tournaments',
  'historical_groups',
  'historical_matches',
  'rating_states',
  'rating_snapshots',
];

async function verifyAllTables() {
  console.log('Verifying PostgreSQL Schema on', supabaseUrl);
  console.log('----------------------------------------------------');
  let successCount = 0;
  let missingCount = 0;

  for (const table of TABLES) {
    try {
      const { data, error } = await supabase.from(table).select('*').limit(1);
      if (error) {
        console.log(`❌ Table '${table}': MISSING (${error.message})`);
        missingCount++;
      } else {
        console.log(`✅ Table '${table}': OK`);
        successCount++;
      }
    } catch (e) {
      console.log(`❌ Table '${table}': Exception (${e.message})`);
      missingCount++;
    }
  }

  console.log('----------------------------------------------------');
  console.log(`Summary: ${successCount}/${TABLES.length} tables verified.`);
  if (successCount === TABLES.length) {
    console.log('STATUS: FULL SCHEMA ACTIVE (GREEN)');
  } else {
    console.log('STATUS: AWAITING SQL MIGRATION EXECUTION');
  }
}

verifyAllTables();
