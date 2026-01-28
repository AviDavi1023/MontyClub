import { NextRequest, NextResponse } from 'next/server'
import { writeData, readData, readMemory } from '@/lib/runtime-store'
import { writeJSONToStorage, readJSONFromStorage, listPaths, removePaths } from '@/lib/supabase'
import { updatesCache, announcementsCache, registrationActionsCache, registrationsCache, usersCache, collectionsCache } from '@/lib/caches'
import { verifyPassword } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// Helper to clear Vercel KV keys if configured
async function clearKVKeys(keys: string[]): Promise<void> {
  try {
    // Check if KV is configured by trying to create a client
    const kvUrl = process.env.VERCEL_KV_URL
    const kvToken = process.env.VERCEL_KV_TOKEN
    
    if (!kvUrl || !kvToken) {
      console.log('[clear-data] Vercel KV not configured, skipping KV deletion')
      return
    }

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createClient } = require('@vercel/kv')
    const kvClient = createClient({ url: kvUrl, token: kvToken })

    for (const key of keys) {
      try {
        await kvClient.del(key)
        console.log(`[clear-data] Deleted KV key: ${key}`)
      } catch (err) {
        console.warn(`[clear-data] Failed to delete KV key ${key}:`, err)
      }
    }
  } catch (err) {
    console.warn('[clear-data] KV deletion failed:', err)
  }
}

// Helper to clear all KV keys matching a pattern (useful for clearing all cached data)
async function clearAllKVKeys(kvClient: any, pattern: string = '*'): Promise<void> {
  try {
    const keys = await kvClient.keys(pattern)
    console.log(`[clear-data] Found ${keys.length} KV keys matching pattern '${pattern}'`)
    
    for (const key of keys) {
      try {
        await kvClient.del(key)
        console.log(`[clear-data] Deleted KV key: ${key}`)
      } catch (err) {
        console.warn(`[clear-data] Failed to delete KV key ${key}:`, err)
      }
    }
  } catch (err) {
    console.warn('[clear-data] Failed to scan KV keys:', err)
  }
}

interface ClearDataRequest {
  password: string
  adminApiKey: string
  clearOptions: {
    localStorage: boolean
    updateRequests: boolean
    announcements: boolean
    registrationCollections: boolean
    registrations: boolean
    analytics: boolean
    settings: boolean
    renewalSettings: boolean
    adminUsers: boolean
  }
}

interface ClearDataResponse {
  success: boolean
  cleared: {
    localStorage?: boolean
    updateRequests?: { count: number }
    announcements?: { count: number }
    registrationCollections?: { count: number }
    registrations?: { count: number }
    analytics?: { filesRemoved: number }
    settings?: { count: number }
    renewalSettings?: { count: number }
    adminUsers?: { count: number }
  }
  errors?: string[]
}

export async function POST(request: NextRequest) {
  try {
    const body: ClearDataRequest = await request.json()
    const { password, adminApiKey, clearOptions } = body

    // Validate request structure
    if (!password || !adminApiKey || !clearOptions) {
      return NextResponse.json(
        { error: 'Missing required fields: password, adminApiKey, clearOptions' },
        { status: 400 }
      )
    }

    // Step 1: Verify admin API key
    const expectedKey = process.env.ADMIN_API_KEY
    if (!expectedKey || adminApiKey !== expectedKey) {
      return NextResponse.json(
        { error: 'Invalid admin API key' },
        { status: 401 }
      )
    }

    // Step 2: Verify admin password by checking against stored users
    const usersData = await readData('admin-users', {})
    const users: Record<string, any> = typeof usersData === 'object' && usersData !== null ? usersData : {}
    
    // Special case: if no admin users exist, require API key + password match (security measure)
    // This allows re-authentication after admin-users have been cleared
    if (Object.keys(users).length === 0) {
      // When admin-users is empty, any password can be used as long as API key is valid
      // This is intentional to allow recovery after factory reset
      console.log('[clear-data] No admin users found - allowing reset with API key only')
    } else {
      // Find user by username matching the provided password
      let adminUser: any = null
      let matchedUsername: string | null = null
      
      // Try to find any user whose password matches
      for (const [username, user] of Object.entries(users)) {
        if (user && user.passwordHash) {
          // Use the verifyPassword utility from lib/auth.ts
          if (verifyPassword(password, user.passwordHash)) {
            adminUser = user
            matchedUsername = username
            break
          }
        }
      }
      
      if (!adminUser) {
        return NextResponse.json(
          { error: 'Invalid password' },
          { status: 401 }
        )
      }
    }

    // Both authentications passed - proceed with clearing data
    const response: ClearDataResponse = {
      success: true,
      cleared: {}
    }
    const errors: string[] = []

    // Clear Update Requests
    if (clearOptions.updateRequests) {
      try {
        const currentUpdates = await readData('updates', [])
        const count = currentUpdates.length
        await writeData('updates', [])
        updatesCache.clear()
        // Clear KV if configured
        await clearKVKeys(['updates'])
        response.cleared.updateRequests = { count }
        console.log(`[clear-data] Cleared ${count} update requests`)
      } catch (err) {
        errors.push(`Failed to clear update requests: ${err}`)
        console.error('[clear-data] Error clearing updates:', err)
      }
    }

    // Clear Announcements
    if (clearOptions.announcements) {
      try {
        const currentAnnouncements = await readData('announcements', {})
        const count = Object.keys(currentAnnouncements).length
        await writeData('announcements', {})
        announcementsCache.clear()
        // Clear KV if configured
        await clearKVKeys(['announcements'])
        response.cleared.announcements = { count }
        console.log(`[clear-data] Cleared ${count} announcements`)
      } catch (err) {
        errors.push(`Failed to clear announcements: ${err}`)
        console.error('[clear-data] Error clearing announcements:', err)
      }
    }

    // Clear Registration Collections
    if (clearOptions.registrationCollections) {
      try {
        const COLLECTIONS_PATH = 'settings/registration-collections.json'
        const collections = await readJSONFromStorage(COLLECTIONS_PATH)
        const count = Array.isArray(collections) ? collections.length : 0
        
        // Create a fresh default collection
        const defaultCollection = {
          id: `col-${Date.now()}`,
          name: `${new Date().getFullYear()} Club Requests`,
          enabled: true,
          accepting: true,
          display: true,
          renewalEnabled: false,
          createdAt: new Date().toISOString()
        }
        
        await writeJSONToStorage(COLLECTIONS_PATH, [defaultCollection])
        collectionsCache.clear()
        // Clear KV if configured
        await clearKVKeys(['settings/registration-collections.json'])
        response.cleared.registrationCollections = { count }
        console.log(`[clear-data] Cleared ${count} registration collections, created default`)
      } catch (err) {
        errors.push(`Failed to clear registration collections: ${err}`)
        console.error('[clear-data] Error clearing collections:', err)
      }
    }

    // Clear clubs snapshot (this is critical - snapshot must be wiped too)
    if (clearOptions.registrationCollections) {
      try {
        const SNAPSHOT_PATH = 'settings/clubs-snapshot.json'
        console.log('[clear-data] Clearing clubs snapshot...')
        // Remove the snapshot file entirely - it will be regenerated when needed
        await removePaths([SNAPSHOT_PATH])
        // Also clear KV and caches
        await clearKVKeys(['settings/clubs-snapshot.json'])
        // Import and clear the clubs cache
        const { invalidateClubsCache } = await import('@/lib/cache-utils')
        invalidateClubsCache()
        console.log('[clear-data] Cleared clubs snapshot successfully')
      } catch (err) {
        // Snapshot might not exist, which is fine
        console.log('[clear-data] Clubs snapshot not found or already cleared:', err)
      }
    }

    // Clear All Registrations
    if (clearOptions.registrations) {
      try {
        // List all registration files
        const registrationPaths = await listPaths('registrations/')
        const count = registrationPaths.length
        
        if (count > 0) {
          console.log(`[clear-data] Found ${count} registration files, removing...`)
          const removeResult = await removePaths(registrationPaths)
          console.log(`[clear-data] Removed ${removeResult.removed} registration files`)
        }
        
        // Clear in-memory and cache
        registrationActionsCache.clear()
        registrationsCache.clear()
        // Clear KV if configured
        await clearKVKeys(['registrations', 'registration-actions-cache'])
        
        response.cleared.registrations = { count }
        console.log(`[clear-data] Cleared all registrations`)
      } catch (err) {
        errors.push(`Failed to clear registrations: ${err}`)
        console.error('[clear-data] Error clearing registrations:', err)
      }
    }

    // Clear Analytics
    if (clearOptions.analytics) {
      try {
        const analyticsPaths = await listPaths('analytics/')
        let filesRemoved = 0
        
        if (analyticsPaths.length > 0) {
          console.log(`[clear-data] Found ${analyticsPaths.length} analytics files, removing...`)
          const result = await removePaths(analyticsPaths)
          filesRemoved = result.removed || analyticsPaths.length
          console.log(`[clear-data] Removed ${filesRemoved} analytics files`)
        }
        
        response.cleared.analytics = { filesRemoved }
        console.log(`[clear-data] Cleared analytics`)
      } catch (err) {
        errors.push(`Failed to clear analytics: ${err}`)
        console.error('[clear-data] Error clearing analytics:', err)
      }
    }

    // Clear Settings
    if (clearOptions.settings) {
      try {
        const currentSettings = await readData('settings', {})
        const count = Object.keys(currentSettings).length
        await writeData('settings', { announcementsEnabled: true })
        // Clear KV if configured
        await clearKVKeys(['settings'])
        response.cleared.settings = { count }
        console.log(`[clear-data] Cleared ${count} settings entries`)
      } catch (err) {
        errors.push(`Failed to clear settings: ${err}`)
        console.error('[clear-data] Error clearing settings:', err)
      }
    }

    // Clear Renewal Settings
    if (clearOptions.renewalSettings) {
      try {
        const currentSettings = await readData('renewal-settings', {})
        const count = Object.keys(currentSettings).length
        await writeData('renewal-settings', {})
        // Clear KV if configured
        await clearKVKeys(['renewal-settings'])
        response.cleared.renewalSettings = { count }
        console.log(`[clear-data] Cleared ${count} renewal settings entries`)
      } catch (err) {
        errors.push(`Failed to clear renewal settings: ${err}`)
        console.error('[clear-data] Error clearing renewal settings:', err)
      }
    }

    // Clear Admin Users
    if (clearOptions.adminUsers) {
      try {
        const currentUsers = await readData('admin-users', {})
        const currentCount = Object.keys(currentUsers).length
        // Reset to empty - users will need to be recreated
        await writeData('admin-users', {})
        usersCache.clear()
        // Clear KV if configured
        await clearKVKeys(['admin-users'])
        response.cleared.adminUsers = { count: currentCount }
        console.log(`[clear-data] Cleared ${currentCount} admin users`)
      } catch (err) {
        errors.push(`Failed to clear admin users: ${err}`)
        console.error('[clear-data] Error clearing admin users:', err)
      }
    }

    // Note: localStorage clearing happens on client side
    if (clearOptions.localStorage) {
      response.cleared.localStorage = true
    }

    // FINAL STEP: Clear all KV cache keys to ensure complete data wipe
    // This is critical because KV might cache data from any of the above operations
    try {
      const kvUrl = process.env.VERCEL_KV_URL
      const kvToken = process.env.VERCEL_KV_TOKEN
      
      if (kvUrl && kvToken) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { createClient } = require('@vercel/kv')
        const kvClient = createClient({ url: kvUrl, token: kvToken })
        
        // Clear all cache-related keys
        const cacheKeys = [
          'updates',
          'announcements',
          'registrations',
          'admin-users',
          'settings',
          'renewal-settings',
          'registration-collections',
          'clubs-cache',
          'updates-cache',
          'announcements-cache',
          'registrations-cache',
          'users-cache',
          'collections-cache',
          'registration-actions-cache',
        ]
        
        console.log('[clear-data] Clearing KV cache keys...')
        await clearKVKeys(cacheKeys)
        
        // Also try to clear any remaining keys with pattern scanning
        try {
          const allKeys = await kvClient.keys('*')
          console.log(`[clear-data] Found ${allKeys.length} remaining KV keys, clearing all...`)
          for (const key of allKeys) {
            try {
              await kvClient.del(key)
              console.log(`[clear-data] Deleted remaining KV key: ${key}`)
            } catch (err) {
              console.warn(`[clear-data] Failed to delete KV key ${key}:`, err)
            }
          }
        } catch (err) {
          console.warn('[clear-data] Failed to scan all KV keys:', err)
        }
        
        console.log('[clear-data] KV clearing complete')
      }
    } catch (err) {
      console.warn('[clear-data] Final KV clearing failed:', err)
    }

    if (errors.length > 0) {
      response.errors = errors
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error in clear-data endpoint:', error)
    return NextResponse.json(
      { error: 'Internal server error', detail: String(error) },
      { status: 500 }
    )
  }
}
