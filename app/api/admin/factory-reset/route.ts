import { NextRequest, NextResponse } from 'next/server'
import { listPaths, removePaths } from '@/lib/supabase'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/factory-reset
 * FULL DATABASE RESET: Wipe all data for completely fresh start
 * Deletes everything: clubs, registrations, settings, admin users, runtime data
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[FACTORY RESET] Starting COMPLETE database wipe...')

    let deletedCount = 0

    // 1. Delete ALL files from Supabase Storage
    const allFiles = [
      // Main data files
      'clubs-snapshot.json',
      'announcements.json',
      'updates.json',
      
      // Settings files
      'settings/admin-users.json',
      'settings/announcements-enabled.json',
      'settings/registration-collections.json',
      'settings/registration-settings.json',
      'settings/renewal-settings.json',
    ]

    for (const file of allFiles) {
      await removePaths([file])
      deletedCount++
      console.log(`[FACTORY RESET] Deleted ${file}`)
    }

    // 2. Delete all registration files
    const registrationFiles = await listPaths('registrations')
    if (registrationFiles.length > 0) {
      await removePaths(registrationFiles)
      deletedCount += registrationFiles.length
      console.log(`[FACTORY RESET] Deleted ${registrationFiles.length} registration files`)
    }

    // 3. Delete all settings files (comprehensive)
    const settingsFiles = await listPaths('settings')
    if (settingsFiles.length > 0) {
      await removePaths(settingsFiles)
      deletedCount += settingsFiles.length
      console.log(`[FACTORY RESET] Deleted ${settingsFiles.length} settings files`)
    }

    // 4. Clear runtime store data directory if it exists
    try {
      const dataDir = path.join(process.cwd(), 'data')
      if (fs.existsSync(dataDir)) {
        const files = fs.readdirSync(dataDir)
        for (const file of files) {
          if (file.endsWith('.json')) {
            fs.unlinkSync(path.join(dataDir, file))
            deletedCount++
            console.log(`[FACTORY RESET] Deleted runtime store: ${file}`)
          }
        }
      }
    } catch (err) {
      console.log('[FACTORY RESET] No runtime store to clear (this is normal in serverless)')
    }

    console.log('[FACTORY RESET] Complete database wipe finished')
    console.log(`[FACTORY RESET] Total files deleted: ${deletedCount}`)

    return NextResponse.json({
      success: true,
      message: 'Complete factory reset finished. All data wiped including admin users. System ready for fresh setup.',
      filesDeleted: deletedCount,
      resetInstructions: [
        '1. Refresh your browser',
        '2. Clear browser localStorage to remove cached data',
        '3. Log in with default admin account (admin/admin123)',
        '4. Set up primary admin email',
        '5. Configure admin API key',
        '6. Change default password immediately'
      ]
    })
  } catch (error) {
    console.error('[FACTORY RESET] Error:', error)
    return NextResponse.json(
      { error: 'Factory reset failed', details: String(error) },
      { status: 500 }
    )
  }
}
  }
}
