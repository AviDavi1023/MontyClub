import { NextRequest, NextResponse } from 'next/server'
import { readJSONFromStorage, writeJSONToStorage } from '@/lib/supabase'
import { ClubRegistration } from '@/types/club'
import { withRegistrationLock } from '@/lib/registration-lock'

export const dynamic = 'force-dynamic'

async function handler(request: NextRequest, body: any) {
  try {
      const adminKey = request.headers.get('x-admin-key')
      const expectedKey = process.env.ADMIN_API_KEY

      if (!adminKey || adminKey !== expectedKey) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        )
      }

      const { registrationId, collection } = body
      if (!registrationId || !collection) {
        return NextResponse.json(
          { error: 'Missing registration ID or collection ID' },
          { status: 400 }
        )
      }

      // Read the registration using collection ID as folder
      const path = `registrations/${collection}/${registrationId}.json`
      const registration: ClubRegistration | null = await readJSONFromStorage(path)

      if (!registration) {
        return NextResponse.json(
          { error: 'Registration not found' },
          { status: 404 }
        )
      }

      // Update status to approved and set approvedAt timestamp
      registration.status = 'approved'
      registration.approvedAt = new Date().toISOString()

      // Save updated registration
      const success = await writeJSONToStorage(path, registration)

      if (!success) {
        return NextResponse.json(
          { error: 'Failed to update registration' },
          { status: 500 }
        )
      }

      return NextResponse.json({ 
        success: true,
        message: 'Registration approved'
      }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        }
      })
    } catch (error) {
      console.error('Error approving registration:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { registrationId, collection } = body
  if (!registrationId || !collection) {
    return NextResponse.json(
      { error: 'Missing registration ID or collection ID' },
      { status: 400 }
    )
  }
  const path = `registrations/${collection}/${registrationId}.json`
  
  // Wrap with registration-level lock, passing parsed body to handler
  return withRegistrationLock(path, () => handler(request, body))
}
