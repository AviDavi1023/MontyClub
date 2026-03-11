import { NextResponse } from 'next/server'
import { listRegistrations } from '@/lib/registrations-db'
import { readData } from '@/lib/runtime-store'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const collectionId = searchParams.get('collectionId')
    
    console.log('[Renewal API] GET /api/renewal-clubs called with collectionId:', collectionId)
    
    // Load renewal settings to determine which collections to fetch from
    const renewalSettings = await readData('renewal-settings', {} as Record<string, { sourceCollections: string[] }>)
    
    console.log('[Renewal API] Loaded renewal settings:', renewalSettings)
    
    // Get source collections for THIS specific collection
    const collectionSettings = collectionId ? renewalSettings[collectionId] : undefined
    const sourceCollections = collectionSettings?.sourceCollections || []
    console.log('[Renewal API] Source collections for', collectionId, ':', sourceCollections)
    
    // Fetch approved clubs from configured source collections using Postgres
    const allClubs: any[] = []
    const MAX_CLUBS = 500 // Limit to prevent excessive loading
    
    try {
      // Determine which collection to fetch renewal candidates from
      let collectionIds: string[] = []
      
      if (sourceCollections.length > 0) {
        // Use configured source collections
        collectionIds = sourceCollections
        console.log('[Renewal API] Using configured source collections:', collectionIds)
      } else {
        // Fallback: fetch from current collection (self-renewal)
        console.log('[Renewal API] No source collections configured, fetching from current collection')
        if (collectionId) {
          collectionIds = [collectionId]
        }
      }

      // Fetch approved clubs from each collection
      for (const loopCollectionId of collectionIds) {
        if (allClubs.length >= MAX_CLUBS) {
          console.log('[Renewal API] Reached MAX_CLUBS limit:', MAX_CLUBS)
          break
        }
        
        try {
          console.log('[Renewal API] Fetching clubs from collection:', loopCollectionId)
          
          // Query Postgres for approved registrations in this collection
          const registrations = await listRegistrations({ 
            collectionId: loopCollectionId,
            status: 'approved'
          })
          
          console.log('[Renewal API] Approved clubs in', loopCollectionId, ':', registrations.length)
          
          allClubs.push(...registrations.slice(0, MAX_CLUBS - allClubs.length))
        } catch (err) {
          console.error(`[Renewal API] Failed to load renewal clubs from collection ${loopCollectionId}:`, err)
          // Continue with other collections on error
        }
      }
    } catch (err) {
      console.error('[Renewal API] Error fetching renewal clubs:', err)
    }

    console.log('[Renewal API] Total clubs collected:', allClubs.length)
    
    // Sort by club name
    allClubs.sort((a, b) => a.clubName.localeCompare(b.clubName))
    
    // Limit to MAX_CLUBS to prevent huge responses
    const limitedClubs = allClubs.slice(0, MAX_CLUBS).map((club) => ({
      id: club.id,
      clubName: club.clubName,
      advisorName: club.advisorName,
      statementOfPurpose: club.statementOfPurpose,
      location: club.location,
      meetingDay: club.meetingDay,
      meetingFrequency: club.meetingFrequency,
      category: club.category,
      socialMedia: club.socialMedia,
    }))

    console.log('[Renewal API] Returning', limitedClubs.length, 'clubs')
    
    return NextResponse.json({ clubs: limitedClubs }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    })
  } catch (err) {
    console.error('[Renewal API] Error:', err)
    return NextResponse.json(
      { error: 'Failed to fetch renewal clubs', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
