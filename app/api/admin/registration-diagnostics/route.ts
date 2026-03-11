import { NextRequest, NextResponse } from 'next/server'
import { listCollections } from '@/lib/collections-db'
import { listRegistrations } from '@/lib/registrations-db'

export const dynamic = 'force-dynamic'

/**
 * GET - Diagnostic endpoint to check registration counts
 * Shows how many registrations exist per collection and status
 */
export async function GET(request: NextRequest) {
  try {

    const collections = await listCollections()
    
    // Get all registrations
    const allRegistrations = await listRegistrations({})
    
    // Group by collection and status
    const diagnostics = collections.map(col => {
      const colRegs = allRegistrations.filter(r => r.collectionId === col.id)
      const approved = colRegs.filter(r => r.status === 'approved')
      const pending = colRegs.filter(r => r.status === 'pending')
      const rejected = colRegs.filter(r => r.status === 'rejected')
      
      return {
        id: col.id,
        name: col.name,
        display: col.display,
        enabled: col.enabled,
        accepting: col.accepting,
        total: colRegs.length,
        approved: approved.length,
        pending: pending.length,
        rejected: rejected.length,
      }
    })

    // Total across all collections
    const totals = {
      total: allRegistrations.length,
      approved: allRegistrations.filter(r => r.status === 'approved').length,
      pending: allRegistrations.filter(r => r.status === 'pending').length,
      rejected: allRegistrations.filter(r => r.status === 'rejected').length,
    }

    return NextResponse.json({
      collections: diagnostics,
      totals,
    })
  } catch (error) {
    console.error('Error in diagnostics:', error)
    return NextResponse.json({ error: 'Failed to get diagnostics', detail: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
