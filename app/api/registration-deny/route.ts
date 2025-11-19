import { NextRequest, NextResponse } from 'next/server'
import { readJSONFromStorage, writeJSONToStorage } from '@/lib/supabase'
import { ClubRegistration } from '@/types/club'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const adminKey = request.headers.get('x-admin-key')
    const expectedKey = process.env.ADMIN_API_KEY

    if (!adminKey || adminKey !== expectedKey) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { registrationId, collection, reason } = body
    if (!registrationId) {
      return NextResponse.json(
        { error: 'Missing registration ID' },
        { status: 400 }
      )
    }

    // Read the registration
    // Try collection path first if provided, then legacy path fallback
    let path: string | null = null
    let registration: ClubRegistration | null = null
    if (collection) {
      const collectionSlug = collection.toLowerCase().replace(/\s+/g, '-')
      const tryPath = `registrations/${collectionSlug}/${registrationId}.json`
      const reg = await readJSONFromStorage(tryPath)
      if (reg) {
        path = tryPath
        registration = reg
      }
    }
    if (!registration) {
      const legacyPath = `registrations/${registrationId}.json`
      const reg = await readJSONFromStorage(legacyPath)
      if (reg) {
        path = legacyPath
        registration = reg
      }
    }

    if (!registration) {
      return NextResponse.json(
        { error: 'Registration not found' },
        { status: 404 }
      )
    }

    // Update status to rejected
    registration.status = 'rejected'
    registration.denialReason = reason || ''

    // Save updated registration
    const success = await writeJSONToStorage(path!, registration)

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to update registration' },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      success: true,
      message: 'Registration denied'
    })
  } catch (error) {
    console.error('Error denying registration:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
