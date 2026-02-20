import { NextRequest, NextResponse } from 'next/server'
import { listCollections } from '@/lib/collections-db'
import { listRegistrations } from '@/lib/registrations-db'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/dashboard-summary
 * Aggregates dashboard metrics from Postgres
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

    // Fetch all collections and registrations from Postgres
    const collections = await listCollections()
    const allRegistrations = await listRegistrations({})

    const pendingCounts: Record<string, number> = {}
    const approvedCounts: Record<string, number> = {}
    const rejectedCounts: Record<string, number> = {}

    let totalPending = 0
    let totalApproved = 0
    let totalRejected = 0

    // Count registrations for each collection
    for (const collection of collections) {
      const colRegs = allRegistrations.filter(r => r.collectionId === collection.id)
      
      let pending = 0
      let approved = 0
      let rejected = 0

      for (const reg of colRegs) {
        if (reg.status === 'pending') pending++
        else if (reg.status === 'approved') approved++
        else if (reg.status === 'rejected') rejected++
      }

      pendingCounts[collection.id] = pending
      approvedCounts[collection.id] = approved
      rejectedCounts[collection.id] = rejected

      totalPending += pending
      totalApproved += approved
      totalRejected += rejected
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
      { error: 'Internal server error', detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
