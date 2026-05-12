
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProjects() {
  const targetBrand = 'ApplyWizz'.toLowerCase();
  console.log(`🔍 Searching for projects matching brand: ${targetBrand}`);

  const { data: projects, error } = await supabase
    .from('projects')
    .select('id, brand, data')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error fetching projects:', error);
    return;
  }

  console.log(`📊 Total projects found: ${projects.length}`);

  const matches = projects.filter(p => {
    const b1 = (p.brand || '').trim().toLowerCase();
    const b2 = (p.data?.brand || '').trim().toLowerCase();
    const b3 = (p.data?.brand_other || '').trim().toLowerCase();
    return b1 === targetBrand || b2 === targetBrand || b3 === targetBrand;
  });

  console.log(`✅ Matching projects found: ${matches.length}`);
  if (matches.length > 0) {
    console.log('Sample match:', JSON.stringify(matches[0], null, 2));
  } else {
    console.log('No matches found. First 5 projects:');
    console.log(JSON.stringify(projects.slice(0, 5), null, 2));
  }
}

checkProjects();
