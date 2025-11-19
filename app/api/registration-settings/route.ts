import { NextRequest, NextResponse } from 'next/server'
import { readJSONFromStorage, writeJSONToStorage } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

interface RegistrationSettings {
  enabled: boolean
  activeCollection: string
}

export async function GET() {
  try {
    const settings = await readJSONFromStorage('settings/registration-settings.json')
    
    if (!settings) {
      // Default settings
      return NextResponse.json({
        enabled: true,
        activeCollection: new Date().getFullYear() + ' Club Requests'
      })
    }

    return NextResponse.json(settings)
  } catch (error) {
    console.error('Error fetching registration settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    )
  }
}

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
    const { enabled, activeCollection } = body

    if (typeof enabled !== 'boolean' || !activeCollection) {
      return NextResponse.json(
        { error: 'Invalid settings' },
        { status: 400 }
      )
    }

    const settings: RegistrationSettings = {
      enabled,
      activeCollection: activeCollection.trim()
    }

    const success = await writeJSONToStorage('settings/registration-settings.json', settings)

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to save settings' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, settings })
  } catch (error) {
    console.error('Error saving registration settings:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
