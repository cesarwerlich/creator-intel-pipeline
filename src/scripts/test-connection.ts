import { supabase } from '../db.js';

async function testConnection() {
  console.log('[Supabase] Testing API connection using keys from .env...');
  
  try {
    // Attempt to query the public schema system-level table or check existing tables
    // Since we don't know which tables are active, we query 'fans' in public schema
    console.log('[Supabase] Querying "public.fans" to test auth...');
    const { data, error, status } = await supabase
      .schema('public')
      .from('fans')
      .select('id')
      .limit(1);

    if (error) {
      console.warn(`[Supabase] Query returned status ${status} with message: ${error.message}`);
      console.warn('[Supabase] Note: If the error is "relation does not exist", your auth succeeded but the table does not exist yet.');
    } else {
      console.log(`[Supabase] SUCCESS! Connected successfully. Retrieved ${data.length} records from public.fans.`);
    }

    // Now test if the 'intel' schema is available
    console.log('\n[Supabase] Checking "intel.sources" table...');
    const { error: intelError, status: intelStatus } = await supabase
      .schema('intel')
      .from('sources')
      .select('id')
      .limit(1);

    if (intelError) {
      if (intelStatus === 404 || intelError.message.includes('does not exist')) {
        console.log('[Supabase] Schema "intel" is NOT initialized yet.');
        console.log('[Supabase] ACTION REQUIRED: Copy the contents of "supabase-migration.sql" and run it in the Supabase Dashboard SQL Editor to initialize it!');
      } else {
        console.error('[Supabase] Unexpected error querying intel schema:', intelError.message);
      }
    } else {
      console.log('[Supabase] SUCCESS! Schema "intel" is already initialized.');
    }

  } catch (err: any) {
    console.error('[Supabase] Connection failed completely:', err.message);
  }
}

testConnection();
