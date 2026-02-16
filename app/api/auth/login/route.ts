import { NextResponse } from 'next/server'
import { readData, writeData } from '@/lib/runtime-store'
import { AdminUser, verifyPassword } from '@/lib/auth'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    if (!body?.username || !body?.password) {
      return NextResponse.json({ error: 'Username and password required' }, { status: 400 })
    }

    const { username, password } = body

    // Get all admin users
    const users: Record<string, AdminUser> = await readData('admin-users', {})

    // Find user by username (case-insensitive)
    const userKey = Object.keys(users).find(
      key => key.toLowerCase() === username.toLowerCase()
    )

    if (!userKey || !users[userKey]) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const user = users[userKey]

    // Verify password
    if (!verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    // Success - return user info (without password hash)
    return NextResponse.json({
      success: true,
      user: {
        username: user.username,
        createdAt: user.createdAt,
        email: user.email,
        isPrimary: user.isPrimary,
      }
    })
  } catch (err) {
    console.error('Login error:', err)
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}
