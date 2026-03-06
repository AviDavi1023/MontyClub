#!/usr/bin/env node

/**
 * Diagnostic script to check clubs table status and club IDs
 */

const { createClient } = require('@supabase/supabase-js');

async function diagnose() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase credentials in environment variables');
    process.exit(1);
  }

  const client = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  try {
    console.log('🔍 Diagnosing clubs table...\n');

    // Check total count
    const { count, error: countError } = await client
      .from('clubs')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('❌ Error counting clubs:', countError);
      process.exit(1);
    }

    console.log(`📊 Total clubs in database: ${count}`);

    if (count === 0) {
      console.log('⚠️  Clubs table is EMPTY!');
      console.log('\nThis explains why announcements are failing - there are no clubs to associate with.\n');
      process.exit(1);
    }

    // Get first 20 club IDs
    const { data: clubs, error: dataError } = await client
      .from('clubs')
      .select('id, name, announcement')
      .limit(20);

    if (dataError) {
      console.error('❌ Error fetching clubs:', dataError);
      process.exit(1);
    }

    console.log('\n📋 First 20 clubs:');
    clubs.forEach((club, i) => {
      const hasAnn = club.announcement ? '✓' : '✗';
      console.log(`  ${i + 1}. ${club.id.substring(0, 20)}... | ${club.name} [Ann: ${hasAnn}]`);
    });

    // Check if any have announcements
    const { data: withAnnouncements, error: annError } = await client
      .from('clubs')
      .select('id, name, announcement')
      .not('announcement', 'is', null)
      .neq('announcement', '');

    if (annError) {
      console.error('❌ Error fetching announcements:', annError);
    } else {
      console.log(`\n📢 Clubs with saved announcements: ${withAnnouncements.length}`);
      withAnnouncements.forEach(club => {
        console.log(`  - ${club.id}: "${club.announcement}"`);
      });
    }

    console.log('\n✅ Database is properly populated');
    console.log('\nℹ️  If your UI is trying to save to clubs NOT in the list above,');
    console.log('   the clubs table may not have migrated from the old system.\n');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

diagnose();
