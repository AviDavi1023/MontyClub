import { NextRequest, NextResponse } from 'next/server'
import { AdminUser, hashPassword } from '@/lib/auth'
import { countAdminUsers, createAdminUser } from '@/lib/admin-users-db'

export const dynamic = 'force-dynamic'

// Initialize admin account with provided credentials
export async function POST(request: NextRequest) {
  try {
    const userCount = await countAdminUsers()

    // If any users exist, don't create another
    if (userCount > 0) {
      return NextResponse.json({ 
        exists: true, 
        message: 'Admin accounts already exist' 
      })
    }

    // Get username, password, and email from request body
    let body: any = {}
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      )
    }

    const { username, password, email } = body

    // Validate inputs
    if (!username || typeof username !== 'string' || username.trim().length < 3) {
      return NextResponse.json(
        { error: 'Username must be at least 3 characters' },
        { status: 400 }
      )
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      )
    }

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Valid email is required' },
        { status: 400 }
      )
    }

    // Create admin account with provided credentials
    const defaultAdmin: AdminUser = {
      username: username.trim().toLowerCase(),
      passwordHash: hashPassword(password),
      email: email.trim().toLowerCase(),
      isPrimary: true, // First admin is always primary
      createdAt: new Date().toISOString(),
      createdBy: 'system',
    }

    await createAdminUser(defaultAdmin)

    return NextResponse.json({
      success: true,
      message: 'Admin account created successfully',
      username: defaultAdmin.username,
    })
  } catch (err) {
    console.error('Error initializing admin:', err)
    return NextResponse.json({ error: 'Failed to initialize' }, { status: 500 })
  }
}
