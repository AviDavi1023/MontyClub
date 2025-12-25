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
    const renewalSettings = await readData('renewal-settings', { 
      enabled: false, 
      sourceCollections: [] as string[] 
    })
    
    console.log('[Renewal API] Loaded renewal settings:', renewalSettings)
    
    const sourceCollections = renewalSettings.sourceCollections || []
    console.log('[Renewal API] Source collections:', sourceCollections)
    
    // Fetch approved clubs from configured source collections
    const allClubs: ClubRegistration[] = []
    const MAX_CLUBS = 500 // Limit to prevent excessive loading
    
    try {
      // If no source collections configured, fetch from ALL collections (backward compatibility)
      let collectionIds: string[] = []
      
      if (sourceCollections.length === 0) {
        console.log('[Renewal API] No source collections configured, fetching from ALL collections')
        // List all collection directories
        const baseCollectionPaths = await listPaths(`club-registrations/`)
        console.log('[Renewal API] Raw collection paths:', baseCollectionPaths)
        
        collectionIds = [...new Set(baseCollectionPaths
          .map(p => {
            const parts = p.split('/')
            console.log('[Renewal API] Path:', p, '-> parts:', parts, '-> id:', parts[1])
            return parts[1]
          })
          .filter(id => {
            const keep = id && id !== 'club-registrations' && id !== collectionId
            console.log('[Renewal API] Filter check for id:', id, '-> keep:', keep)
            return keep
          })
        )]
        console.log('[Renewal API] Final collection IDs:', collectionIds)
      } else {
        // Use configured source collections (excluding target collection)
        collectionIds = sourceCollections.filter((id: string) => id !== collectionId)
        console.log('[Renewal API] Using configured source collections:', collectionIds)
      }

      // Fetch clubs from each collection
      for (const loopCollectionId of collectionIds) {
        if (allClubs.length >= MAX_CLUBS) {
          console.log('[Renewal API] Reached MAX_CLUBS limit:', MAX_CLUBS)
          break
        }
        
        try {
          console.log('[Renewal API] Fetching clubs from collection:', loopCollectionId)
          const paths = await listPaths(`club-registrations/${loopCollectionId}/`)
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
