import { NextResponse } from 'next/server'
import { readData } from '@/lib/runtime-store'
import { AdminUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/setup-status
 * Check if initial admin setup has been completed
 * Returns { setupComplete: boolean }
 */
export async function GET() {
  try {
    const users: Record<string, AdminUser> = await readData('admin-users', {})
    const hasUsers = Object.keys(users).length > 0

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
