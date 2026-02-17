import { NextRequest, NextResponse } from 'next/server'
import { listPaths, removePaths } from '@/lib/supabase'
import { verifyPassword } from '@/lib/auth'
import { deleteAllAdminUsers, listAdminUsers } from '@/lib/admin-users-db'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/factory-reset
 * FULL DATABASE RESET: Wipe all data for completely fresh start
 * Deletes everything: clubs, registrations, settings, admin users, runtime data
 * Requires admin password + API key verification before reset
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body for authentication
    const body = await request.json()
    const { password, adminApiKey } = body

    // Verify admin API key
    const expectedKey = process.env.ADMIN_API_KEY
    if (!adminApiKey || adminApiKey !== expectedKey) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      )
    }

    // Verify admin password (check against any admin user)
    const users = await listAdminUsers()

    if (users.length === 0) {
      return NextResponse.json(
        { error: 'No admin users found' },
        { status: 401 }
      )
    }

    // Check if the password matches any admin user
    const isValidPassword = users.some(user => verifyPassword(password, user.passwordHash))

    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Invalid admin password' },
        { status: 401 }
      )
    }

    console.log('[FACTORY RESET] Authentication successful, starting COMPLETE database wipe...')

    let deletedCount = 0

    // 1. Delete ALL files from Supabase Storage
    const allFiles = [
      // Main data files (stored at root via writeData)
      'clubs-snapshot.json',
      'announcements.json',
      'updates.json',
      'admin-users.json',
      'settings.json',
      'renewal-settings.json',
      
      // Settings files (stored in settings/ subdirectory via writeJSONToStorage)
      'settings/registration-settings.json',
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

    // 4. Clear admin users from database
    try {
      await deleteAllAdminUsers()
    } catch (err) {
      console.warn('[FACTORY RESET] Failed to clear admin users table:', err)
    }

    // 5. Clear runtime store data directory if it exists
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
