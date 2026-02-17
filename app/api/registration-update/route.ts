import { NextRequest, NextResponse } from 'next/server'
import { ClubRegistration } from '@/types/club'
import { withRegistrationLock } from '@/lib/registration-lock'
import { getRegistrationById, updateRegistration } from '@/lib/registrations-db'

export const dynamic = 'force-dynamic'

async function handler(request: NextRequest, body: any) {
  try {
    const { registrationId, updates } = body
    if (!registrationId || !updates) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }
    
    const registration = await getRegistrationById(registrationId)
    if (!registration) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 })
    }
    
    // Update registration in Postgres
    await updateRegistration(registrationId, updates)
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Registration update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const adminKey = request.headers.get('x-admin-key')
  const expectedKey = process.env.ADMIN_API_KEY
  if (!adminKey || adminKey !== expectedKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const body = await request.json()
  const { registrationId } = body
  if (!registrationId) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
  }
  
  // Wrap with registration-level lock, passing parsed body to handler
  return withRegistrationLock(`registration-${registrationId}`, () => handler(request, body))
}
