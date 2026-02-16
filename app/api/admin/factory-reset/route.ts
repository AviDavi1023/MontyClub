import { NextRequest, NextResponse } from 'next/server'
import { listPaths, removePaths } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/factory-reset
 * ONE-TIME RESET: Wipe all data for fresh start
 * This endpoint will be removed after initial deployment
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[FACTORY RESET] Starting complete data wipe...')

    // List of specific files to delete
    const specificFiles = [
      'clubs-snapshot.json',
      'announcements.json',
      'updates.json',
      'settings/admin-users.json',
      'settings/announcements-enabled.json',
      'settings/registration-collections.json',
    ]

    // Delete specific files
    for (const file of specificFiles) {
      await removePaths([file])
      console.log(`[FACTORY RESET] Deleted ${file}`)
    }

    // Delete all registration files
    const registrationFiles = await listPaths('registrations')
    if (registrationFiles.length > 0) {
      await removePaths(registrationFiles)
      console.log(`[FACTORY RESET] Deleted ${registrationFiles.length} registration files`)
    }

    console.log('[FACTORY RESET] Complete data wipe finished')

    return NextResponse.json({
      success: true,
      message: 'Factory reset complete. All data wiped. System ready for fresh setup.',
      filesDeleted: specificFiles.length + registrationFiles.length
    })
  } catch (error) {
    console.error('[FACTORY RESET] Error:', error)
    return NextResponse.json(
      { error: 'Factory reset failed' },
      { status: 500 }
    )
  }
}
