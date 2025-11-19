import { NextRequest, NextResponse } from 'next/server'
import { writeJSONToStorage } from '@/lib/supabase'
import { ClubRegistration } from '@/types/club'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
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
      status: 'pending'
    }

    // Store in Supabase
    const path = `registrations/${id}.json`
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

    // Get all registrations from storage
    const { listPaths, readJSONFromStorage } = await import('@/lib/supabase')
    const paths = await listPaths('registrations')
    
    const registrations: ClubRegistration[] = []
    for (const path of paths) {
      if (path.endsWith('.json')) {
        const data = await readJSONFromStorage(path)
        if (data) {
          registrations.push(data)
        }
      }
    }

    // Sort by submission date (newest first)
    registrations.sort((a, b) => 
      new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    )

    return NextResponse.json({ registrations })
  } catch (error) {
    console.error('Error fetching registrations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch registrations' },
      { status: 500 }
    )
  }
}
