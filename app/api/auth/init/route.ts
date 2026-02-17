import { NextRequest, NextResponse } from 'next/server'
import { AdminUser, hashPassword } from '@/lib/auth'
import { countAdminUsers, createAdminUser } from '@/lib/admin-users-db'

export const dynamic = 'force-dynamic'

// Initialize default admin account if none exists
export async function POST(request: NextRequest) {
  try {
    const userCount = await countAdminUsers()

    // If any users exist, don't create default
    if (userCount > 0) {
      return NextResponse.json({ 
        exists: true, 
        message: 'Admin accounts already exist' 
      })
    }

    // Try to get email from request body (for initial setup)
    let primaryEmail = ''
    try {
      const body = await request.json()
      primaryEmail = body.email || ''
    } catch {
      // No body provided, will need to set email later
    }

    // Create default admin account
    const defaultAdmin: AdminUser = {
      username: 'admin',
      passwordHash: hashPassword('admin123'),
      email: primaryEmail || undefined,
      isPrimary: true, // First admin is always primary
      createdAt: new Date().toISOString(),
      createdBy: 'system',
    }

    await createAdminUser(defaultAdmin)

    return NextResponse.json({
      success: true,
      message: 'Default admin account created',
      username: 'admin',
      password: 'admin123', // Only shown once during initialization
      needsEmail: !primaryEmail,
    })
  } catch (err) {
    console.error('Error initializing admin:', err)
    return NextResponse.json({ error: 'Failed to initialize' }, { status: 500 })
  }
}
