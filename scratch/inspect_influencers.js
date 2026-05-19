const SUPABASE_URL = 'https://kifpnlyljlxppuzizmsf.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpZnBubHlsamx4cHB1eml6bXNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwMzUxOTUsImV4cCI6MjA4NTYxMTE5NX0.G3OP5BGBj6p8rwLTsynszI-_kWQTmesvwuIobpxg5cI';

async function run() {
  const id = 'e88dc115-dddf-4a22-9e63-3041719c67e7';
  console.log('Querying influencers by ID using ANON key...');
  const response = await fetch(`${SUPABASE_URL}/rest/v1/influencers?id=eq.${id}&select=*`, {
    method: 'GET',
    headers: {
      'apikey': ANON_KEY,
      'Authorization': `Bearer ${ANON_KEY}`
    }
  });
  
  const text = await response.text();
  console.log('Result Status:', response.status);
  console.log('Result Body:', text);
}

run().catch(console.error);
