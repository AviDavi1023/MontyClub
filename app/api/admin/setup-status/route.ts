import { NextResponse } from 'next/server'
import { countAdminUsers } from '@/lib/admin-users-db'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/setup-status
 * Check if initial admin setup has been completed
 * Returns { setupComplete: boolean }
 */
export async function GET() {
  try {
    const count = await countAdminUsers()
    const hasUsers = count > 0

    return NextResponse.json({
      setupComplete: hasUsers,
    })
  } catch (error) {
    console.error('Error checking setup status:', error)
    return NextResponse.json(
      { error: 'Failed to check setup status' },
      { status: 500 }
    )
  }
}
