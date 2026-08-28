import { createClient } from '@supabase/supabase-js';
import process from 'node:process';

process.loadEnvFile('.env.local');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const secretKey = process.env.SUPABASE_SECRET_KEY || '';

const supabase = createClient(supabaseUrl, secretKey);

async function checkSecurity() {
  console.log('--- Checking Superadmin in profiles ---');
  const { data: superadmins, error: saErr } = await supabase
    .from('profiles')
    .select('id, email, role, admin_status')
    .eq('role', 'super_admin');

  if (saErr) {
    console.error('Error fetching superadmins:', saErr.message);
  } else {
    console.log('Superadmin profiles:', superadmins);
  }

  console.log('--- Checking Tournament Participants Constraints ---');
  const { data: tp, error: tpErr } = await supabase
    .from('tournament_participants')
    .select('tournament_id, user_id')
    .limit(1);

  if (tpErr) {
    console.error('Error with tournament_participants:', tpErr.message);
  } else {
    console.log('tournament_participants table query success');
  }
}

checkSecurity();
