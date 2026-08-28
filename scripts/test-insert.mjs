import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const secretKey = process.env.SUPABASE_SECRET_KEY || '';
const supabase = createClient(supabaseUrl, secretKey);

async function test() {
  const { data: t } = await supabase.from('historical_tournaments').select('*');
  const { data: p } = await supabase.from('players').select('*');
  console.log('Tournaments in DB:', t?.length);
  console.log('Players in DB:', p?.length);

  const testMatch = {
    id: '00000000-0000-4000-8000-000000000001',
    historical_tournament_id: t[0].id,
    stage: 'group',
    player1_id: p[0].id,
    player2_id: p[1].id,
    score_player1: 15,
    score_player2: 1,
    winner_id: null,
    status: 'missing'
  };

  const res = await supabase.from('historical_matches').insert([testMatch]);
  console.log('Test match insert result:', res);
}

test();
