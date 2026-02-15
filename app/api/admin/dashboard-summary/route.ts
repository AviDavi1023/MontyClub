import { NextRequest, NextResponse } from 'next/server'
import { readJSONFromStorage } from '@/lib/supabase'
import { RegistrationCollection, ClubRegistration } from '@/types/club'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/dashboard-summary
 * Aggregates dashboard metrics across all collections in a single call
 * 
 * Returns: {
 *   collections: RegistrationCollection[],
 *   pendingCounts: { [collectionId]: number },
 *   approvedCounts: { [collectionId]: number },
 *   rejectedCounts: { [collectionId]: number },
 *   totalPending: number,
 *   totalApproved: number,
 *   totalRejected: number,
 *   timestamp: string
 * }
 * 
 * Replaces N individual API calls with a single aggregated call
 */
export async function GET(request: NextRequest) {
  try {
    const adminKey = request.headers.get('x-admin-key')
    const expectedKey = process.env.ADMIN_API_KEY

    if (!adminKey || adminKey !== expectedKey) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Fetch collections
    const collectionsData = await readJSONFromStorage('settings/registration-collections.json')
    const collections: RegistrationCollection[] = Array.isArray(collectionsData) ? collectionsData : []

    const pendingCounts: Record<string, number> = {}
    const approvedCounts: Record<string, number> = {}
    const rejectedCounts: Record<string, number> = {}

    let totalPending = 0
    let totalApproved = 0
    let totalRejected = 0

    // Count registrations for each collection
    for (const collection of collections) {
      try {
        const registrationsData = await readJSONFromStorage(`registrations/${collection.id}/index.json`)
        
        let pending = 0
        let approved = 0
        let rejected = 0

        if (registrationsData && Array.isArray(registrationsData)) {
          for (const reg of registrationsData) {
            if (reg.status === 'pending') pending++
            else if (reg.status === 'approved') approved++
            else if (reg.status === 'rejected') rejected++
          }
        }

        pendingCounts[collection.id] = pending
        approvedCounts[collection.id] = approved
        rejectedCounts[collection.id] = rejected

        totalPending += pending
        totalApproved += approved
        totalRejected += rejected
      } catch (err) {
        // Collection has no registrations file yet
        pendingCounts[collection.id] = 0
        approvedCounts[collection.id] = 0
        rejectedCounts[collection.id] = 0
      }
    }

    return NextResponse.json(
      {
        collections,
        pendingCounts,
        approvedCounts,
        rejectedCounts,
        totalPending,
        totalApproved,
        totalRejected,
        timestamp: new Date().toISOString(),
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        }
      }
    )
  } catch (error) {
    console.error('[DashboardSummary] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard summary' },
      { status: 500 }
    )
  }
}
