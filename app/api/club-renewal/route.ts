import { NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import { listCollections } from '@/lib/collections-db'
import { createRegistration } from '@/lib/registrations-db'
import { ClubRegistration } from '@/types/club'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      collectionId,
      originalClubId,
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
      location,
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

    // Validate collection exists and renewal is enabled
    const collections = await listCollections()
    const targetCollection = collections.find(c => c.id === collectionId)
    
    if (!targetCollection) {
      return NextResponse.json({ error: 'Invalid collection ID' }, { status: 404 })
    }
    
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
      location: location || '',
      meetingDay: meetingDay || '',
      submittedAt: new Date().toISOString(),
      status: 'pending',
      advisorAgreementDate: new Date().toISOString(),
      clubAgreementDate: new Date().toISOString(),
      renewedFromId: originalClubId || undefined,
    }

    // Save to Postgres
    await createRegistration(registration)

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
    return NextResponse.json({ 
      error: 'Failed to submit club renewal',
      detail: err instanceof Error ? err.message : String(err)
    }, { status: 500 })
  }
}
