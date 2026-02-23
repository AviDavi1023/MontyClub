import { NextRequest, NextResponse } from 'next/server'
import { writeData, readData, readMemory } from '@/lib/runtime-store'
import { writeJSONToStorage, readJSONFromStorage, listPaths, removePaths } from '@/lib/supabase'
import { updatesCache, announcementsCache, registrationActionsCache, registrationsCache, usersCache, collectionsCache } from '@/lib/caches'
import { verifyPassword } from '@/lib/auth'
import { deleteAllAdminUsers, listAdminUsers } from '@/lib/admin-users-db'
import { listCollections, createCollection } from '@/lib/collections-db'
import { listRegistrations, deleteRegistration } from '@/lib/registrations-db'
import { createClient } from '@supabase/supabase-js'

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
    const users = await listAdminUsers()

    // Special case: if no admin users exist, require API key + password match (security measure)
    // This allows re-authentication after admin-users have been cleared
    if (users.length === 0) {
      // When admin-users is empty, any password can be used as long as API key is valid
      // This is intentional to allow recovery after factory reset
      console.log('[clear-data] No admin users found - allowing reset with API key only')
    } else {
      let passwordMatched = false
      for (const user of users) {
        if (user?.passwordHash && verifyPassword(password, user.passwordHash)) {
          passwordMatched = true
          break
        }
      }

      if (!passwordMatched) {
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

    // Clear Registration Collections (POSTGRES + Storage)
    // CRITICAL: Must clear registrations BEFORE collections due to foreign key constraints
    if (clearOptions.registrationCollections) {
      try {
        // Step 1: Get current collections count
        const collections = await listCollections()
        const count = collections.length
        
        // Step 2: Delete ALL registrations first (required due to foreign key constraints)
        console.log('[clear-data] Deleting all registrations before collections (foreign key requirement)...')
        const allRegistrations = await listRegistrations({})
        for (const reg of allRegistrations) {
          await deleteRegistration(reg.id)
        }
        console.log(`[clear-data] Deleted ${allRegistrations.length} registrations from Postgres`)
        
        // Step 3: Delete all collections from Postgres
        console.log('[clear-data] Deleting collections from Postgres...')
        const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        
        if (supabaseUrl && supabaseServiceKey) {
          const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
            auth: { autoRefreshToken: false, persistSession: false }
          })
          
          // Delete all collections (now safe since registrations are gone)
          const { error: deleteError } = await (supabaseAdmin.from('registration_collections') as any)
            .delete()
            .neq('id', 'impossible-id') // Delete all (Supabase requires a condition)
          
          if (deleteError) {
            console.error('[clear-data] Error deleting collections:', deleteError)
            throw deleteError
          }
          
          console.log(`[clear-data] Deleted ${count} collections from Postgres`)
        }
        
        // Step 4: Create a fresh default collection in Postgres
        const defaultCollection = {
          id: `col-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          name: `${new Date().getFullYear()} Club Requests`,
          enabled: true,
          accepting: true,
          display: true,
          renewalEnabled: false,
          createdAt: new Date().toISOString()
        }
        
        await createCollection(defaultCollection)
        console.log('[clear-data] Created default collection in Postgres')
        
        // Step 5: Clear legacy Storage files (if any)
        try {
          const COLLECTIONS_PATH = 'settings/registration-collections.json'
          await writeJSONToStorage(COLLECTIONS_PATH, [defaultCollection])
        } catch (storageErr) {
          // Storage might not exist, ignore
          console.log('[clear-data] Storage collections not found (expected after Postgres migration)')
        }
        
        // Step 6: Clear caches
        collectionsCache.clear()
        registrationsCache.clear()
        registrationActionsCache.clear()
        await clearKVKeys(['settings/registration-collections.json', 'registrations'])
        
        response.cleared.registrationCollections = { count }
        console.log(`[clear-data] ✅ Cleared ${count} registration collections, created default`)
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

    // Clear All Registrations (POSTGRES + Storage)
    if (clearOptions.registrations) {
      try {
        // Step 1: Delete registrations from Postgres
        console.log('[clear-data] Deleting all registrations from Postgres...')
        const allRegistrations = await listRegistrations({})
        const count = allRegistrations.length
        
        for (const reg of allRegistrations) {
          await deleteRegistration(reg.id)
        }
        console.log(`[clear-data] Deleted ${count} registrations from Postgres`)
        
        // Step 2: Clear legacy Storage files (if any)
        try {
          const registrationPaths = await listPaths('registrations/')
          if (registrationPaths.length > 0) {
            console.log(`[clear-data] Found ${registrationPaths.length} legacy registration files in Storage, removing...`)
            const removeResult = await removePaths(registrationPaths)
            console.log(`[clear-data] Removed ${removeResult.removed} registration files from Storage`)
          }
        } catch (storageErr) {
          // Storage might not exist, ignore
          console.log('[clear-data] Storage registrations not found (expected after Postgres migration)')
        }
        
        // Step 3: Clear caches
        registrationActionsCache.clear()
        registrationsCache.clear()
        await clearKVKeys(['registrations', 'registration-actions-cache'])
        
        response.cleared.registrations = { count }
        console.log(`[clear-data] ✅ Cleared ${count} registrations`)
      } catch (err) {
        errors.push(`Failed to clear registrations: ${err}`)
        console.error('[clear-data] Error clearing registrations:', err)
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
        const currentUsers = await listAdminUsers()
        const currentCount = currentUsers.length
        // Clear DB users and legacy storage data
        await deleteAllAdminUsers()
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
