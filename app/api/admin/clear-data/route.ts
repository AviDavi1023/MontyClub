import { NextRequest, NextResponse } from 'next/server'
import { writeData, readData } from '@/lib/runtime-store'
import { writeJSONToStorage, readJSONFromStorage, listPaths, removePaths } from '@/lib/supabase'
import { updatesCache, announcementsCache, registrationActionsCache } from '@/lib/caches'

export const dynamic = 'force-dynamic'

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
    const usersData = await readData('admin-users', [])
    const users = Array.isArray(usersData) ? usersData : []
    const adminUser = users.find((u: any) => u.role === 'admin')
    
    if (!adminUser) {
      return NextResponse.json(
        { error: 'No admin user found' },
        { status: 401 }
      )
    }

    // Import bcrypt for password verification
    const bcrypt = require('bcryptjs')
    const passwordMatch = await bcrypt.compare(password, adminUser.password)
    
    if (!passwordMatch) {
      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 401 }
      )
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
        updatesCache.set([])
        updatesCache.clear()
        response.cleared.updateRequests = { count }
      } catch (err) {
        errors.push(`Failed to clear update requests: ${err}`)
      }
    }

    // Clear Announcements
    if (clearOptions.announcements) {
      try {
        const currentAnnouncements = await readData('announcements', {})
        const count = Object.keys(currentAnnouncements).length
        await writeData('announcements', {})
        announcementsCache.set({})
        announcementsCache.clear()
        response.cleared.announcements = { count }
      } catch (err) {
        errors.push(`Failed to clear announcements: ${err}`)
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
          createdAt: new Date().toISOString()
        }
        
        await writeJSONToStorage(COLLECTIONS_PATH, [defaultCollection])
        response.cleared.registrationCollections = { count }
      } catch (err) {
        errors.push(`Failed to clear registration collections: ${err}`)
      }
    }

    // Clear All Registrations
    if (clearOptions.registrations) {
      try {
        const registrationPaths = await listPaths('registrations/')
        if (registrationPaths.length > 0) {
          await removePaths(registrationPaths)
        }
        registrationActionsCache.clear()
        response.cleared.registrations = { count: registrationPaths.length }
      } catch (err) {
        errors.push(`Failed to clear registrations: ${err}`)
      }
    }

    // Clear Analytics
    if (clearOptions.analytics) {
      try {
        const analyticsPaths = await listPaths('analytics/')
        let filesRemoved = 0
        
        if (analyticsPaths.length > 0) {
          const result = await removePaths(analyticsPaths)
          filesRemoved = result.removed || 0
        }
        
        response.cleared.analytics = { filesRemoved }
      } catch (err) {
        errors.push(`Failed to clear analytics: ${err}`)
      }
    }

    // Note: localStorage clearing happens on client side
    if (clearOptions.localStorage) {
      response.cleared.localStorage = true
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
