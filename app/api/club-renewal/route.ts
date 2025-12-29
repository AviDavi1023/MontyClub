import { NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import { writeJSONToStorage } from '@/lib/supabase'
import { ClubRegistration } from '@/types/club'
import { readData } from '@/lib/runtime-store'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      collectionId, // Target collection for the renewal
      originalClubId, // Original club being renewed (for reference)
      clubName,
      category,
      meetingFrequency,
      meetingDay,
      advisorName,
      advisorEmail,
      studentContactName,
      studentContactEmail,
      clubEmail,
      socialMedia,
      statementOfPurpose,
      agreements,
    } = body

    // Validate required fields
    if (!collectionId) {
      return NextResponse.json({ error: 'Collection ID is required' }, { status: 400 })
    }
    
    if (!clubName || !advisorName || !advisorEmail || !studentContactName || !studentContactEmail) {
      return NextResponse.json({ 
        error: 'Missing required fields: clubName, advisorName, advisorEmail, studentContactName, studentContactEmail' 
      }, { status: 400 })
    }

    if (!agreements?.supervision || !agreements?.codeOfConduct || !agreements?.dataAccuracy) {
      return NextResponse.json({ error: 'All agreements must be accepted' }, { status: 400 })
    }

    // Get active registration collections to validate target collection
    const collectionsResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/registration-collections`)
    if (!collectionsResponse.ok) {
      return NextResponse.json({ error: 'Failed to validate collection' }, { status: 500 })
    }
    
    const collectionsData = await collectionsResponse.json()
    const targetCollection = collectionsData.collections?.find((c: any) => c.id === collectionId)
    
    if (!targetCollection) {
      return NextResponse.json({ error: 'Invalid collection ID' }, { status: 400 })
    }
    
    // Verify renewal is enabled for this collection
    if (!targetCollection.renewalEnabled) {
      return NextResponse.json({ error: 'Club renewal is not enabled for this collection' }, { status: 403 })
    }

    // Create new registration with renewal status
    const registration: ClubRegistration = {
      id: nanoid(),
      collectionId,
      email: advisorEmail,
      clubName,
      category: category || '',
      meetingFrequency: meetingFrequency || '',
      advisorName,
      studentContactName,
      studentContactEmail,
      socialMedia: socialMedia || '',
      statementOfPurpose: statementOfPurpose || '',
      submittedAt: new Date().toISOString(),
      status: 'pending',
      location: '',
      meetingDay: meetingDay || '',
      advisorAgreementDate: new Date().toISOString(),
      clubAgreementDate: new Date().toISOString(),
      notes: originalClubId ? `Renewal of club ID: ${originalClubId}` : 'Club renewal',
    }

    // Save to storage
    const path = `club-registrations/${collectionId}/${registration.id}.json`
    await writeJSONToStorage(path, registration)

    console.log('[POST /api/club-renewal] Created renewal registration:', registration.id)

    return NextResponse.json({ 
      message: 'Club renewal submitted successfully',
      registration 
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (err) {
    console.error('Error submitting club renewal:', err)
    return NextResponse.json({ error: 'Failed to submit club renewal' }, { status: 500 })
  }
}
