import { NextRequest, NextResponse } from 'next/server'
import { readJSONFromStorage } from '@/lib/supabase'
import { withSnapshotLock } from '@/lib/snapshot-lock'
import { publishCatalogSnapshot } from '@/lib/snapshot-publish'
import { requireAdminApiKey } from '@/lib/admin-api-key'

export const dynamic = 'force-dynamic'

const noCacheHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
}

/**
 * Admin endpoint to publish a static catalog snapshot
 * Generates clubs-snapshot.json from approved registrations in Postgres
 * This provides instant loading without scanning 100+ registration files
 */
export async function POST(request: NextRequest) {
  const authError = requireAdminApiKey(request)
  if (authError) return authError

  try {
    console.log('[Publish Catalog] Starting catalog generation...')

    // Verify Supabase is configured
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[Publish Catalog] Supabase not configured properly')
      return NextResponse.json(
        { error: 'Supabase storage not configured. Check environment variables.' },
        { status: 500 }
      )
    }

    // Wrap entire publish in snapshot lock to prevent concurrent publishes
    return await withSnapshotLock(async () => {
      const snapshot = await publishCatalogSnapshot({ autoAssignDisplayCollection: true })

      console.log(`[Publish Catalog] Successfully published ${snapshot.clubCount} clubs`)

      return NextResponse.json({
        success: true,
        message: `Catalog published successfully`,
        clubCount: snapshot.clubCount,
        generatedAt: snapshot.generatedAt,
        collectionId: snapshot.collectionId,
        collectionName: snapshot.collectionName,
      }, { headers: noCacheHeaders })
    })
  } catch (error) {
    console.error('[Publish Catalog] Error:', error)
    return NextResponse.json(
      { error: 'Failed to publish catalog', detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

/**
 * GET endpoint to check snapshot status
 */
export async function GET(request: NextRequest) {
  const authError = requireAdminApiKey(request)
  if (authError) return authError

  try {
    const snapshot = await readJSONFromStorage('settings/clubs-snapshot.json')
    
    if (!snapshot || !snapshot.metadata) {
      return NextResponse.json({
        exists: false,
        message: 'No published catalog found'
      }, { headers: noCacheHeaders })
    }

    return NextResponse.json({
      exists: true,
      ...snapshot.metadata
    }, { headers: noCacheHeaders })
  } catch (error) {
    console.error('[Publish Catalog] Error checking status:', error)
    return NextResponse.json(
      { error: 'Failed to check snapshot status' },
      { status: 500 }
    )
  }
}

