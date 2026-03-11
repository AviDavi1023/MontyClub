import { NextResponse } from 'next/server'
import { AdminUser, hashPassword, generatePassword } from '@/lib/auth'
import { countAdminUsers, createAdminUser, deleteAdminUser, getAdminUserByUsername, listAdminUsers } from '@/lib/admin-users-db'

// Get all admin users (requires authentication in real app - simplified for now)
export async function GET() {
  try {
    const users = await listAdminUsers()

    // Return users without password hashes
    const safeUsers = users.map(user => ({
      username: user.username,
      email: user.email || undefined,
      isPrimary: user.isPrimary || false,
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
    const body = await request.json()
    
    if (!body?.username) {
      return NextResponse.json({ error: 'Username required' }, { status: 400 })
    }

    const { username, password, createdBy } = body
    
    // Get existing users
    const normalizedUsername = username.trim().toLowerCase()
    const existingUser = await getAdminUserByUsername(normalizedUsername)

    if (existingUser) {
      return NextResponse.json({ error: 'Username already exists' }, { status: 400 })
    }

    // Generate password if not provided
    const finalPassword = password || generatePassword(12)
    const passwordHash = hashPassword(finalPassword)

    // Create new user
    const newUser: AdminUser = {
      username: normalizedUsername,
      passwordHash,
      createdAt: new Date().toISOString(),
      createdBy: createdBy || 'system',
    }

    // Save user
    await createAdminUser(newUser)

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
    const body = await request.json()
    
    if (!body?.username) {
      return NextResponse.json({ error: 'Username required' }, { status: 400 })
    }

    const { username } = body
    
    const userCount = await countAdminUsers()

    // Check if this is the last admin
    if (userCount <= 1) {
      return NextResponse.json({ error: 'Cannot delete the last admin user' }, { status: 400 })
    }

    const existingUser = await getAdminUserByUsername(username)

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    await deleteAdminUser(existingUser.username)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Error deleting admin user:', err)
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 })
  }
}
