import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/factory-reset
 * ONE-TIME RESET: Wipe all data for fresh start
 * This endpoint will be removed after initial deployment
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[FACTORY RESET] Starting complete data wipe...')

    // List all files to delete
    const filesToDelete = [
      'clubs-snapshot.json',
      'announcements.json',
      'updates.json',
      'settings/admin-users.json',
      'settings/announcements-enabled.json',
      'settings/registration-collections.json',
    ]

    // Delete all registration files
    const { data: registrationFiles } = await supabaseAdmin.storage
      .from('club-data')
      .list('registrations')
    
    if (registrationFiles && registrationFiles.length > 0) {
      const regPaths = registrationFiles.map(f => `registrations/${f.name}`)
      await supabaseAdmin.storage.from('club-data').remove(regPaths)
      console.log(`[FACTORY RESET] Deleted ${regPaths.length} registration files`)
    }

    // Delete all main files
    for (const file of filesToDelete) {
      await supabaseAdmin.storage.from('club-data').remove([file])
      console.log(`[FACTORY RESET] Deleted ${file}`)
    }

    console.log('[FACTORY RESET] Complete data wipe finished')

    return NextResponse.json({
      success: true,
      message: 'Factory reset complete. All data wiped. System ready for fresh setup.'
    })
  } catch (error) {
    console.error('[FACTORY RESET] Error:', error)
    return NextResponse.json(
      { error: 'Factory reset failed' },
      { status: 500 }
    )
  }
}
