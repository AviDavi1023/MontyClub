import { NextRequest, NextResponse } from 'next/server'
import { writeJSONToStorage } from '@/lib/supabase'
import { ClubRegistration } from '@/types/club'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // Check if registration is enabled
    const settingsResp = await fetch(`${request.nextUrl.origin}/api/registration-settings`)
    const settings = await settingsResp.json()
    
    if (!settings.enabled) {
      return NextResponse.json(
        { error: 'Registration is currently closed' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      email,
      clubName,
      advisorName,
      statementOfPurpose,
      location,
      meetingDay,
      meetingFrequency,
      studentContactName,
      studentContactEmail,
      advisorAgreementDate,
      clubAgreementDate
    } = body

    // Validate required fields
    if (!email || !clubName || !advisorName || !statementOfPurpose || !location || 
        !meetingDay || !meetingFrequency || !studentContactName || !studentContactEmail ||
        !advisorAgreementDate || !clubAgreementDate) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      )
    }

    // Create registration object
    const id = `reg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    const registration: ClubRegistration = {
      id,
      email,
      clubName,
      advisorName,
      statementOfPurpose,
      location,
      meetingDay,
      meetingFrequency,
      studentContactName,
      studentContactEmail,
      advisorAgreementDate,
      clubAgreementDate,
      submittedAt: new Date().toISOString(),
      status: 'pending',
      collection: settings.activeCollection
    }

    // Store in Supabase under collection folder
    const collectionSlug = settings.activeCollection.toLowerCase().replace(/\s+/g, '-')
    const path = `registrations/${collectionSlug}/${id}.json`
    const success = await writeJSONToStorage(path, registration)

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to save registration' },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      success: true, 
      id,
      message: 'Registration submitted successfully' 
    })
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const adminKey = request.headers.get('x-admin-key')
    const expectedKey = process.env.ADMIN_API_KEY

    if (!adminKey || adminKey !== expectedKey) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const collection = searchParams.get('collection')

    // Get all registrations from storage
    const { listPaths, readJSONFromStorage } = await import('@/lib/supabase')
    
    let paths: string[] = []
    if (collection) {
      const collectionSlug = collection.toLowerCase().replace(/\s+/g, '-')
      paths = await listPaths(`registrations/${collectionSlug}`)
    } else {
      paths = await listPaths('registrations')
    }
    
    const registrations: ClubRegistration[] = []
    const collections = new Set<string>()
    
    for (const path of paths) {
      if (path.endsWith('.json')) {
        const data = await readJSONFromStorage(path)
        if (data) {
          registrations.push(data)
          if (data.collection) {
            collections.add(data.collection)
          }
        }
      }
    }

    // Sort by submission date (newest first)
    registrations.sort((a, b) => 
      new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    )

    return NextResponse.json({ 
      registrations,
      collections: Array.from(collections).sort()
    })
  } catch (error) {
    console.error('Error fetching registrations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch registrations' },
      { status: 500 }
    )
  }
}
