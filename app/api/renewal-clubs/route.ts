import { NextResponse } from 'next/server'
import { listPaths, readJSONFromStorage } from '@/lib/supabase'
import { ClubRegistration } from '@/types/club'
import { readData } from '@/lib/runtime-store'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: Request) {
  try {
    // Load renewal settings to determine which collections to fetch from
    const renewalSettings = await readData('renewal-settings', { 
      enabled: false, 
      sourceCollections: [] as string[] 
    })
    
    const sourceCollections = renewalSettings.sourceCollections || []
    
    // Fetch approved clubs from configured source collections
    const allClubs: ClubRegistration[] = []
    const MAX_CLUBS = 500 // Limit to prevent excessive loading
    
    try {
      // If no source collections configured, fetch from ALL collections (backward compatibility)
      let collectionIds: string[] = []
      
      if (sourceCollections.length === 0) {
        // List all collection directories
        const baseCollectionPaths = await listPaths(`club-registrations/`)
        collectionIds = [...new Set(baseCollectionPaths
          .map(p => p.split('/')[1])
          .filter(id => id && id !== 'club-registrations')
        )]
      } else {
        // Use configured source collections
        collectionIds = sourceCollections
      }

      // Fetch clubs from each collection
      for (const collectionId of collectionIds) {
        if (allClubs.length >= MAX_CLUBS) break
        
        try {
          const paths = await listPaths(`club-registrations/${collectionId}/`)
          const jsonPaths = paths.filter(p => p.endsWith('.json')).slice(0, MAX_CLUBS - allClubs.length)
          
          // Parallel read for performance
          const registrations = await Promise.all(
            jsonPaths.map(path => readJSONFromStorage(path).catch(() => null))
          )
          
          // Only include approved registrations and filter out null errors
          const approvedClubs = registrations
            .filter((reg): reg is ClubRegistration => 
              reg !== null && reg && reg.status === 'approved'
            )
          
          allClubs.push(...approvedClubs)
        } catch (err) {
          console.error(`Failed to load renewal clubs from collection ${collectionId}:`, err)
          // Continue with other collections on error
        }
      }
    } catch (err) {
      console.error('Failed to list collection directories:', err)
    }

    // Sort by club name
    allClubs.sort((a, b) => a.clubName.localeCompare(b.clubName))
    
    // Limit to MAX_CLUBS to prevent huge responses
    const limitedClubs = allClubs.slice(0, MAX_CLUBS)

    return NextResponse.json({ clubs: limitedClubs }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (err) {
    console.error('Error fetching renewal clubs:', err)
    return NextResponse.json({ error: 'Failed to fetch renewal clubs', clubs: [] }, { status: 500 })
  }
}
