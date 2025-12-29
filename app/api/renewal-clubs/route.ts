import { NextResponse } from 'next/server'
import { listPaths, readJSONFromStorage } from '@/lib/supabase'
import { ClubRegistration } from '@/types/club'
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
    
    // Fetch approved clubs from configured source collections
    const allClubs: ClubRegistration[] = []
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

      // Fetch clubs from each collection
      for (const loopCollectionId of collectionIds) {
        if (allClubs.length >= MAX_CLUBS) {
          console.log('[Renewal API] Reached MAX_CLUBS limit:', MAX_CLUBS)
          break
        }
        
        try {
          console.log('[Renewal API] Fetching clubs from collection:', loopCollectionId)
          const paths = await listPaths(`registrations/${loopCollectionId}/`)
          console.log('[Renewal API] Found paths in', loopCollectionId, ':', paths.length)
          
          const jsonPaths = paths.filter(p => p.endsWith('.json')).slice(0, MAX_CLUBS - allClubs.length)
          console.log('[Renewal API] JSON files in', loopCollectionId, ':', jsonPaths.length)
          
          // Parallel read for performance
          const registrations = await Promise.all(
            jsonPaths.map(path => readJSONFromStorage(path).catch(() => null))
          )
          
          console.log('[Renewal API] Loaded registrations from', loopCollectionId, ':', registrations.length)
          
          // Only include approved registrations and filter out null errors
          const approvedClubs = registrations
            .filter((reg): reg is ClubRegistration => 
              reg !== null && reg && reg.status === 'approved'
            )
          
          console.log('[Renewal API] Approved clubs in', loopCollectionId, ':', approvedClubs.length)
          
          allClubs.push(...approvedClubs)
        } catch (err) {
          console.error(`[Renewal API] Failed to load renewal clubs from collection ${loopCollectionId}:`, err)
          // Continue with other collections on error
        }
      }
    } catch (err) {
      console.error('[Renewal API] Failed to list collection directories:', err)
    }

    console.log('[Renewal API] Total clubs collected:', allClubs.length)
    
    // Sort by club name
    allClubs.sort((a, b) => a.clubName.localeCompare(b.clubName))
    
    // Limit to MAX_CLUBS to prevent huge responses
    const limitedClubs = allClubs.slice(0, MAX_CLUBS)

    console.log('[Renewal API] Returning', limitedClubs.length, 'clubs')
    
    return NextResponse.json({ clubs: limitedClubs }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (err) {
    console.error('[Renewal API] Exception in GET /api/renewal-clubs:', err)
    return NextResponse.json({ error: 'Failed to fetch renewal clubs', clubs: [] }, { status: 500 })
  }
}
