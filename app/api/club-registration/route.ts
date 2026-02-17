import { NextRequest, NextResponse } from 'next/server'
import { ClubRegistration } from '@/types/club'
import { getCollectionById, listCollections } from '@/lib/collections-db'
import { createRegistration, listRegistrations } from '@/lib/registrations-db'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const collectionSlug = searchParams.get('collection')

    if (!collectionSlug) {
      return NextResponse.json(
        { error: 'Collection parameter is required' },
        { status: 400 }
      )
    }

    // Import slugifyName for consistent slug comparison
    const { slugifyName } = await import('@/lib/slug')
    
    // Get collections and find by name slug (instantly consistent from Postgres)
    const collections = await listCollections()
    const collection = collections.find(c => 
      slugifyName(c.name) === slugifyName(collectionSlug)
    )
    
    if (!collection) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      )
    }

    // Accept if 'accepting' is true; fallback to legacy 'enabled'
    const accepting = (typeof (collection as any).accepting === 'boolean') ? (collection as any).accepting : collection.enabled
    if (!accepting) {
      return NextResponse.json(
        { error: 'Registration is currently closed for this collection' },
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
      clubAgreementDate,
      socialMedia,
      category,
      notes
    } = body

    // Validate required fields
    if (!email || !clubName || !advisorName || !statementOfPurpose || !location || 
        !meetingDay || !meetingFrequency || !studentContactName || !studentContactEmail ||
        !advisorAgreementDate || !clubAgreementDate || !category) {
      return NextResponse.json(
        { error: 'All required fields must be filled' },
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
      collectionId: collection.id,
      socialMedia,
      category,
      notes
    }

    // Store in Postgres
    await createRegistration(registration)

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
    const collectionSlug = searchParams.get('collection')

    if (!collectionSlug) {
      return NextResponse.json(
        { error: 'Collection parameter is required' },
        { status: 400 }
      )
    }

    // Import slugifyName for consistent slug comparison
    const { slugifyName } = await import('@/lib/slug')
    
    // Get collections and find by name slug
    const collections = await listCollections()
    const collection = collections.find(c => 
      slugifyName(c.name) === slugifyName(collectionSlug)
    )
    
    if (!collection) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      )
    }

    // Get all registrations from Postgres for this collection
    const registrations = await listRegistrations({ collectionId: collection.id })

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
