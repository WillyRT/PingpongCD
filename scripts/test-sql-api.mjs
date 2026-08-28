const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const secretKey = process.env.SUPABASE_SECRET_KEY || '';

async function testSqlApi() {
  // Test 1: Project query endpoint
  try {
    const res = await fetch(`${supabaseUrl}/database/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'apikey': secretKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: 'SELECT version();' }),
    });
    console.log('Test 1 /database/query status:', res.status);
    const body = await res.text();
    console.log('Response:', body.slice(0, 150));
  } catch (e) {
    console.log('Test 1 failed:', e.message);
  }

  // Test 2: pg endpoint
  try {
    const res = await fetch(`${supabaseUrl}/pg/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'apikey': secretKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: 'SELECT version();' }),
    });
    console.log('Test 2 /pg/query status:', res.status);
    const body = await res.text();
    console.log('Response:', body.slice(0, 150));
  } catch (e) {
    console.log('Test 2 failed:', e.message);
  }
}

testSqlApi();
