import { NextRequest, NextResponse } from 'next/server'
import { writeJSONToStorage, readJSONFromStorage } from '@/lib/supabase'
import { ClubRegistration, RegistrationCollection } from '@/types/club'

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
    
    // Get collections and find by name slug with retry for eventual consistency
    let collection: RegistrationCollection | undefined
    const maxRetries = 5
    const baseDelay = 300 // ms - increased from 200
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const collectionsData = await readJSONFromStorage('settings/registration-collections.json')
      const collections: RegistrationCollection[] = collectionsData || []
      collection = collections.find(c => 
        slugifyName(c.name) === slugifyName(collectionSlug)
      )
      
      if (collection) {
        console.log(`[Club Registration] Found collection on attempt ${attempt + 1}/${maxRetries}`)
        break
      }
      
      // If not found and not last attempt, wait before retry with exponential backoff
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(1.5, attempt) // Exponential backoff: 300ms, 450ms, 675ms, etc.
        console.log(`[Club Registration] Collection not found (attempt ${attempt + 1}), retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
    
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

    // Store in Supabase under collection folder
    const path = `registrations/${collection.id}/${id}.json`
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
    const collectionSlug = searchParams.get('collection')

    if (!collectionSlug) {
      return NextResponse.json(
        { error: 'Collection parameter is required' },
        { status: 400 }
      )
    }

    // Import slugifyName for consistent slug comparison
    const { slugifyName } = await import('@/lib/slug')
    
    // Get collections and find by name slug with retry for eventual consistency
    const { listPaths } = await import('@/lib/supabase')
    let collection: RegistrationCollection | undefined
    const maxRetries = 3
    const retryDelay = 200 // ms
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const collectionsData = await readJSONFromStorage('settings/registration-collections.json')
      const collections: RegistrationCollection[] = collectionsData || []
      collection = collections.find(c => 
        slugifyName(c.name) === slugifyName(collectionSlug)
      )
      
      if (collection) break
      
      // If not found and not last attempt, wait before retry
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)))
      }
    }
    
    if (!collection) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      )
    }

    // Get all registrations from storage for this collection
    const paths = await listPaths(`registrations/${collection.id}`)
    const jsonPaths = paths.filter(p => p.endsWith('.json'))
    
    // Read all registrations in parallel for performance
    const registrationPromises = jsonPaths.map(path => readJSONFromStorage(path))
    const allRegs = await Promise.all(registrationPromises)
    const registrations: ClubRegistration[] = allRegs.filter(
      data => data && data.collectionId === collection.id
    )

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
