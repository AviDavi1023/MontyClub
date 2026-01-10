import { NextResponse } from 'next/server'
import { readData, writeData } from '@/lib/runtime-store'
import { AdminUser, hashPassword, generatePassword } from '@/lib/auth'

// Get all admin users (requires authentication in real app - simplified for now)
export async function GET() {
  try {
    const users: Record<string, AdminUser> = await readData('admin-users', {})
    
    // Return users without password hashes
    const safeUsers = Object.values(users).map(user => ({
      username: user.username,
      createdAt: user.createdAt,
      createdBy: user.createdBy,
    }))

    return NextResponse.json({ users: safeUsers })
  } catch (err) {
    console.error('Error fetching admin users:', err)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}

// Create a new admin user
export async function POST(request: Request) {
  try {
    // Verify admin API key
    const adminKey = request.headers.get('x-admin-key')
    const expectedKey = process.env.ADMIN_API_KEY
    
    if (!adminKey || adminKey !== expectedKey) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    
    if (!body?.username) {
      return NextResponse.json({ error: 'Username required' }, { status: 400 })
    }

    const { username, password, createdBy } = body
    
    // Get existing users
    const users: Record<string, AdminUser> = await readData('admin-users', {})

    // Check if username already exists (case-insensitive)
    const existingUser = Object.keys(users).find(
      key => key.toLowerCase() === username.toLowerCase()
    )

    if (existingUser) {
      return NextResponse.json({ error: 'Username already exists' }, { status: 400 })
    }

    // Generate password if not provided
    const finalPassword = password || generatePassword(12)
    const passwordHash = hashPassword(finalPassword)

    // Create new user
    const newUser: AdminUser = {
      username: username.trim(),
      passwordHash,
      createdAt: new Date().toISOString(),
      createdBy: createdBy || 'system',
    }

    // Save user
    users[username.toLowerCase()] = newUser
    await writeData('admin-users', users)

    // Return success with generated password (only shown once!)
    return NextResponse.json({
      success: true,
      user: {
        username: newUser.username,
        createdAt: newUser.createdAt,
      },
      password: finalPassword, // Only returned on creation
    })
  } catch (err) {
    console.error('Error creating admin user:', err)
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
  }
}

// Delete an admin user
export async function DELETE(request: Request) {
  try {
    // Verify admin API key
    const adminKey = request.headers.get('x-admin-key')
    const expectedKey = process.env.ADMIN_API_KEY
    
    if (!adminKey || adminKey !== expectedKey) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    
    if (!body?.username) {
      return NextResponse.json({ error: 'Username required' }, { status: 400 })
    }

    const { username } = body
    
    const users: Record<string, AdminUser> = await readData('admin-users', {})

    // Check if this is the last admin
    if (Object.keys(users).length <= 1) {
      return NextResponse.json({ error: 'Cannot delete the last admin user' }, { status: 400 })
    }

    const userKey = Object.keys(users).find(
      key => key.toLowerCase() === username.toLowerCase()
    )

    if (!userKey) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    delete users[userKey]
    await writeData('admin-users', users)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Error deleting admin user:', err)
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 })
  }
}
