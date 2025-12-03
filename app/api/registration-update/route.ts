import { NextRequest, NextResponse } from 'next/server'
import { readJSONFromStorage, writeJSONToStorage } from '@/lib/supabase'
import { ClubRegistration } from '@/types/club'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const adminKey = request.headers.get('x-admin-key')
    const expectedKey = process.env.ADMIN_API_KEY
    if (!adminKey || adminKey !== expectedKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const body = await request.json()
    const { registrationId, collection, updates } = body
    if (!registrationId || !collection || !updates) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }
    const path = `registrations/${collection}/${registrationId}.json`
    const registration: ClubRegistration | null = await readJSONFromStorage(path)
    if (!registration) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 })
    }
    // Update all fields provided in updates
    Object.assign(registration, updates)
    const success = await writeJSONToStorage(path, registration)
    if (!success) {
      return NextResponse.json({ error: 'Failed to update registration' }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Registration update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
