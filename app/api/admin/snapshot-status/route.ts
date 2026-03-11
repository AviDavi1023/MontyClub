import { NextRequest, NextResponse } from 'next/server'
import { readJSONFromStorage } from '@/lib/supabase'
import { withSnapshotLock } from '@/lib/snapshot-lock'
import { publishCatalogSnapshot } from '@/lib/snapshot-publish'
import { requireAdminApiKey } from '@/lib/admin-api-key'

export const dynamic = 'force-dynamic'

/**
 * GET: Check snapshot status (exists, timestamp, club count)
 * POST: Manually trigger snapshot publish using Postgres data
 */

export async function GET(request: NextRequest) {
  const authError = requireAdminApiKey(request)
  if (authError) return authError

  try {
    // Check if snapshot exists
    const snapshot = await readJSONFromStorage('settings/clubs-snapshot.json')

    if (!snapshot) {
      return NextResponse.json({
        exists: false,
        generatedAt: null,
        clubCount: null,
        collectionId: null,
        collectionName: null,
      })
    }

    return NextResponse.json({
      exists: true,
      generatedAt: snapshot.metadata?.generatedAt || null,
      clubCount: snapshot.metadata?.clubCount || snapshot.clubs?.length || 0,
      collectionId: snapshot.metadata?.collectionId || null,
      collectionName: snapshot.metadata?.collectionName || null,
    })
  } catch (error) {
    console.error('[Snapshot Status] Error checking status:', error)
    return NextResponse.json(
      { error: 'Failed to check snapshot status' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const authError = requireAdminApiKey(request)
  if (authError) return authError

  try {
    console.log('[Snapshot] Manual publish triggered by admin...')

    // Wrap entire publish in snapshot lock to prevent concurrent publishes
    return await withSnapshotLock(async () => {
      const snapshot = await publishCatalogSnapshot({ autoAssignDisplayCollection: false })

      console.log(`[Snapshot] ✅ Manual publish successful: ${snapshot.clubCount} clubs`)

      return NextResponse.json({
        success: true,
        message: `Published ${snapshot.clubCount} clubs`,
        snapshot: {
          generatedAt: snapshot.generatedAt,
          clubCount: snapshot.clubCount,
          collectionId: snapshot.collectionId,
          collectionName: snapshot.collectionName,
        }
      })
    })
  } catch (error) {
    console.error('[Snapshot] Error during manual publish:', error)
    // If we get here, snapshot lock failed or something went wrong inside
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to publish snapshot' },
      { status: 500 }
    )
  }
}
