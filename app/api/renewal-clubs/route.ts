import { NextResponse } from 'next/server'
import { listPaths, readJSONFromStorage } from '@/lib/supabase'
import { ClubRegistration } from '@/types/club'
import { readData } from '@/lib/runtime-store'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: Request) {
  try {
    // Get renewal settings to determine source collections
    const renewalSettings = await readData('renewal-settings', { 
      enabled: false, 
      sourceCollections: [] as string[] 
    })

    if (!renewalSettings.enabled || !renewalSettings.sourceCollections || renewalSettings.sourceCollections.length === 0) {
      return NextResponse.json({ clubs: [] })
    }

    // Fetch approved clubs from all source collections
    const allClubs: ClubRegistration[] = []
    
    for (const collectionId of renewalSettings.sourceCollections) {
      const paths = await listPaths(`club-registrations/${collectionId}/`)
      const jsonPaths = paths.filter(p => p.endsWith('.json'))
      
      // Parallel read for performance
      const registrations = await Promise.all(
        jsonPaths.map(path => readJSONFromStorage(path))
      )
      
      // Only include approved registrations
      const approvedClubs = registrations.filter(reg => 
        reg && reg.status === 'approved'
      )
      
      allClubs.push(...approvedClubs)
    }

    // Sort by club name
    allClubs.sort((a, b) => a.clubName.localeCompare(b.clubName))

    return NextResponse.json({ clubs: allClubs }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (err) {
    console.error('Error fetching renewal clubs:', err)
    return NextResponse.json({ error: 'Failed to fetch renewal clubs' }, { status: 500 })
  }
}
