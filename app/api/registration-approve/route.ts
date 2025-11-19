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
    const { registrationId, collection } = body

    if (!registrationId || !collection) {
      return NextResponse.json(
        { error: 'Missing registration ID or collection' },
        { status: 400 }
      )
    }

    // Read the registration
    const collectionSlug = collection.toLowerCase().replace(/\s+/g, '-')
    const path = `registrations/${collectionSlug}/${registrationId}.json`
    const registration: ClubRegistration | null = await readJSONFromStorage(path)

    if (!registration) {
      return NextResponse.json(
        { error: 'Registration not found' },
        { status: 404 }
      )
    }

    // Update status to approved
    registration.status = 'approved'

    // Save updated registration
    const success = await writeJSONToStorage(path, registration)

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to update registration' },
        { status: 500 }
      )
    }

    // TODO: Send approval email
    // For now, we'll prepare the email content
    const emailContent = {
      to: registration.email,
      subject: `Club Charter Approved - ${registration.clubName}`,
      body: `
Dear ${registration.advisorName},

Congratulations! Your club charter request for "${registration.clubName}" has been approved.

Submitted Information:
- Club Name: ${registration.clubName}
- Advisor: ${registration.advisorName}
- Statement of Purpose: ${registration.statementOfPurpose}
- Location: ${registration.location}
- Meeting Day: ${registration.meetingDay}
- Meeting Frequency: ${registration.meetingFrequency}
- Student Contact: ${registration.studentContactName} (${registration.studentContactEmail})

Next steps will be communicated to you shortly.

Best regards,
ASB Club Management
      `.trim()
    }

    console.log('Approval email to send:', emailContent)

    return NextResponse.json({ 
      success: true,
      message: 'Registration approved',
      emailSent: false // Will be true once email service is integrated
    })
  } catch (error) {
    console.error('Error approving registration:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
