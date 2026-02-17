import { NextRequest, NextResponse } from 'next/server'
import { readJSONFromStorage, writeJSONToStorage, listPaths, removePaths } from '@/lib/supabase'
import { RegistrationCollection, ClubRegistration, Club } from '@/types/club'
import { validateCollections, ensureSingleDisplay } from '@/lib/collection-validation'
import { getQueueLock } from '@/lib/queue-lock'
import { collectionsCache } from '@/lib/caches'

export const dynamic = 'force-dynamic'

const COLLECTIONS_PATH = 'settings/registration-collections.json'
const DEBUG = process.env.NODE_ENV === 'development'
const collectionsLock = getQueueLock('registration-collections', 30000)

// Track last write time for read-after-write consistency optimization
let lastWriteTimestamp = 0

// Simple logging helper - only logs in development
function log(data: object) {
  if (DEBUG) {
    try {
      console.log(JSON.stringify(data))
    } catch {}
  }
}

/**
 * Clear the collections cache
 * Useful when you want to force a fresh read from Supabase
 */
function clearCollectionsCache(): void {
  collectionsCache.clear()
  log({ tag: 'collections-cache', step: 'cleared' })
}

// Retry helper with exponential backoff + jitter
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 100
): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      if (attempt < maxAttempts - 1) {
        // Exponential backoff with jitter
        const delay = baseDelayMs * Math.pow(2, attempt)
        const jitter = Math.random() * delay
        await new Promise(r => setTimeout(r, delay + jitter))
      }
    }
  }

  throw lastError
}

/**
 * Wait for Supabase to propagate a write (read-after-write consistency)
 * Retries reading the collection until the expected state is found
 * @param collectionId Collection ID to verify
 * @param expectedState Partial state that must exist in the collection
 * @param maxRetries How many times to retry (each ~200ms)
 */
async function verifyConsistency(
  collectionId: string,
  expectedState: Partial<RegistrationCollection>,
  maxRetries: number = 5
): Promise<boolean> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) {
      // Wait before retry (increasing backoff: 100ms, 200ms, 400ms...)
      await new Promise(r => setTimeout(r, 100 * Math.pow(2, attempt - 1)))
    }

    try {
      const collections = await readJSONFromStorage(COLLECTIONS_PATH) || []
      const found = collections.find((c: RegistrationCollection) => c.id === collectionId)

      if (found) {
        // Check if all expected fields match
        let allMatch = true
        for (const [key, expectedValue] of Object.entries(expectedState)) {
          if ((found as any)[key] !== expectedValue) {
            allMatch = false
            break
          }
        }

        if (allMatch) {
          log({ tag: 'collections-consistency', step: 'verified', collectionId, attempt })
          return true
        }
      }
    } catch (e) {
      log({ tag: 'collections-consistency', step: 'read-failed', collectionId, attempt, error: String(e) })
    }
  }

  log({ tag: 'collections-consistency', step: 'verification-timeout', collectionId, maxRetries })
  return false
}

async function getCollections(): Promise<RegistrationCollection[]> {
  // STRATEGY 1: Check cache first (5-second TTL)
  // This handles read-after-write within same serverless worker
  const cached = collectionsCache.get(5000)
  if (cached) {
    log({ tag: 'collections-read', step: 'cache-hit', count: cached.length })
    return cached
  }

  // STRATEGY 2: Enhanced retry logic for recent writes
  // If we just wrote to Supabase (<3 seconds ago), be more aggressive with retries
  const timeSinceLastWrite = Date.now() - lastWriteTimestamp
  const wasRecentWrite = timeSinceLastWrite < 3000
  const maxAttempts = wasRecentWrite ? 8 : 3 // More retries if recent write
  const baseDelay = wasRecentWrite ? 150 : 100 // Longer delays if recent write

  log({ 
    tag: 'collections-read', 
    step: 'read-start', 
    wasRecentWrite, 
    timeSinceLastWrite,
    maxAttempts 
  })

  // STRATEGY 3: Retry with exponential backoff + jitter
  const data = await withRetry(
    async () => {
      const result = await readJSONFromStorage(COLLECTIONS_PATH, true)
      // After factory reset, collections file won't exist - that's a valid state
      // Return empty array if file doesn't exist or is invalid
      if (!result) {
        return []
      }
      if (!Array.isArray(result)) {
        console.warn('[getCollections] Collections data is not an array, resetting to empty', { result })
        return []
      }
      return result
    },
    maxAttempts,
    baseDelay
  )

  // Parse and normalize collections
  const cols: RegistrationCollection[] = data.map((c: any) => ({
    id: String(c.id),
    name: String(c.name),
    enabled: Boolean(c.enabled),
    createdAt: String(c.createdAt),
    display: typeof c.display === 'boolean' ? c.display : undefined,
    accepting: typeof c.accepting === 'boolean' ? c.accepting : Boolean(c.enabled),
    renewalEnabled: typeof c.renewalEnabled === 'boolean' ? c.renewalEnabled : false,
  }))

  // Update cache for subsequent reads
  collectionsCache.set(cols)
  log({ tag: 'collections-read', step: 'cache-updated', count: cols.length })

  return cols
}

async function saveCollections(collections: RegistrationCollection[]): Promise<boolean> {
  // Validate collections before saving
  const errors = validateCollections(collections)
  if (errors.length > 0) {
    console.warn('[Collections Validation] Errors found:', errors)
    // Continue anyway but log
  }
  
  // Ensure only one has display: true
  const fixed = ensureSingleDisplay(collections)
  
  try {
    // Write with retry - writeJSONToStorage already handles retries and eventual consistency
    const ok = await withRetry(() => writeJSONToStorage(COLLECTIONS_PATH, fixed), 3, 100)
    if (!ok) {
      console.error('[saveCollections] Write failed after retries')
      return false
    }

    // CRITICAL: Update cache immediately after successful write
    // This ensures subsequent reads within 5 seconds see the latest data
    collectionsCache.set(fixed)
    lastWriteTimestamp = Date.now()
    
    log({ 
      tag: 'collections-persistence', 
      step: 'write-succeeded',
      cacheUpdated: true,
      timestamp: lastWriteTimestamp
    })
    return true
  } catch (err) {
    console.error('[saveCollections] Exception:', err)
    return false
  }
}

// GET - List all collections (no lock needed, read-only)
export async function GET(request: NextRequest) {
  const operationId = `GET-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
  
  try {
    const adminKey = request.headers.get('x-admin-key')
    const expectedKey = process.env.ADMIN_API_KEY

    if (!adminKey || adminKey !== expectedKey) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    log({ tag: 'collections-api', step: 'get-start', operationId })
    const collections = await getCollections()
    log({ tag: 'collections-api', step: 'get-done', operationId, count: collections.length })
    
    // Sort by creation date (newest first)
    const sorted = [...collections].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )

    return NextResponse.json({ collections: sorted })
  } catch (error) {
    console.error('Error fetching collections:', error)
    return NextResponse.json(
      { error: 'Failed to fetch collections' },
      { status: 500 }
    )
  }
}

// POST - Create new collection
export async function POST(request: NextRequest) {
  const operationId = `POST-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`

  return collectionsLock.withLock(operationId, async () => {
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
      const { name, enabled = false } = body

      if (!name || typeof name !== 'string' || !name.trim()) {
        return NextResponse.json(
          { error: 'Collection name is required' },
          { status: 400 }
        )
      }

      log({ tag: 'collections-api', step: 'post-start', operationId, name })

      const collections = await getCollections()

      // Check for duplicate names (exact match)
      if (collections.some(c => c.name.toLowerCase() === name.trim().toLowerCase())) {
        return NextResponse.json(
          { error: 'Collection with this name already exists' },
          { status: 400 }
        )
      }

      // Check for slug collisions (different names that produce same slug)
      const { slugifyName } = await import('@/lib/slug')
      const newSlug = slugifyName(name.trim())
      const existingWithSameSlug = collections.find(c => slugifyName(c.name) === newSlug)
      
      if (existingWithSameSlug) {
        return NextResponse.json(
          { error: `Collection name would create duplicate URL (conflicts with "${existingWithSameSlug.name}"). Please choose a different name.` },
          { status: 400 }
        )
      }

      const newCollection: RegistrationCollection = {
        id: `col-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        name: name.trim(),
        enabled: Boolean(enabled),
        createdAt: new Date().toISOString(),
        display: false,
        accepting: Boolean(enabled),
      }

      collections.push(newCollection)
      const success = await saveCollections(collections)

      if (!success) {
        return NextResponse.json(
          { error: 'Failed to create collection' },
          { status: 500 }
        )
      }

      log({ tag: 'collections-api', step: 'post-done', operationId, id: newCollection.id })
      return NextResponse.json({ success: true, collection: newCollection })
    } catch (error) {
      console.error('Error creating collection:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  })
}

// PATCH - Update collection (name or enabled status)
export async function PATCH(request: NextRequest) {
  const operationId = `PATCH-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`

  return collectionsLock.withLock(operationId, async () => {
    const body = await request.json()
    log({ tag: 'collections-api', step: 'received', operationId, id: body.id, enabled: body.enabled })

    try {
      // Environment sanity checks
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
        return NextResponse.json(
          { error: 'Supabase environment not configured' },
          { status: 500 }
        )
      }

      const adminKey = request.headers.get('x-admin-key')
      const expectedKey = process.env.ADMIN_API_KEY

      if (!adminKey || adminKey !== expectedKey) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        )
      }

      const { id, name, enabled, accepting, display, renewalEnabled } = body

      if (!id) {
        return NextResponse.json(
          { error: 'Collection ID is required' },
          { status: 400 }
        )
      }

      // Read collections with retry for recently created collections
      log({ tag: 'collections-api', step: 'read-start', operationId })
      let collections = await getCollections()
      let collectionIndex = collections.findIndex(c => c.id === id)

      // If not found and this might be a recent write, retry a few times
      if (collectionIndex === -1) {
        const timeSinceWrite = Date.now() - lastWriteTimestamp
        const isRecentWrite = timeSinceWrite < 5000
        
        if (isRecentWrite) {
          log({ 
            tag: 'collections-api', 
            step: 'collection-not-found-retrying',
            operationId,
            collectionId: id,
            timeSinceWrite
          })
          
          // Retry up to 3 times with increasing delays
          for (let attempt = 0; attempt < 3; attempt++) {
            await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt)))
            collections = await getCollections()
            collectionIndex = collections.findIndex(c => c.id === id)
            
            if (collectionIndex !== -1) {
              log({ 
                tag: 'collections-api', 
                step: 'collection-found-on-retry',
                operationId,
                collectionId: id,
                attempt: attempt + 1
              })
              break
            }
          }
        }
      }

      if (collectionIndex === -1) {
        const timeSinceWrite = Date.now() - lastWriteTimestamp
        const isRecentWrite = timeSinceWrite < 5000
        
        log({ 
          tag: 'collections-api', 
          step: 'collection-not-found',
          operationId,
          collectionId: id,
          timeSinceWrite,
          isRecentWrite
        })

        return NextResponse.json(
          { 
            error: 'Collection not found',
            detail: isRecentWrite 
              ? 'Collection was recently created. Please wait a moment and try again.'
              : undefined
          },
          { status: 404 }
        )
      }

      // Track what we're actually changing
      const changes: Partial<RegistrationCollection> = {}

      // Update fields if provided
      if (name !== undefined) {
        if (typeof name !== 'string' || !name.trim()) {
          return NextResponse.json(
            { error: 'Invalid collection name' },
            { status: 400 }
          )
        }
        // Check for duplicate names (excluding current collection)
        if (collections.some((c, idx) => idx !== collectionIndex && c.name.toLowerCase() === name.trim().toLowerCase())) {
          return NextResponse.json(
            { error: 'Collection with this name already exists' },
            { status: 400 }
          )
        }
        // Check for slug collisions (different names that produce same slug)
        const { slugifyName } = await import('@/lib/slug')
        const newSlug = slugifyName(name.trim())
        const existingWithSameSlug = collections.find((c, idx) => idx !== collectionIndex && slugifyName(c.name) === newSlug)
        if (existingWithSameSlug) {
          return NextResponse.json(
            { error: `Collection name would create duplicate URL (conflicts with "${existingWithSameSlug.name}"). Please choose a different name.` },
            { status: 400 }
          )
        }
        collections[collectionIndex].name = name.trim()
        changes.name = name.trim()
      }

      // Back-compat: 'enabled' now maps to 'accepting' unless 'accepting' explicitly provided
      if (enabled !== undefined && accepting === undefined) {
        const val = Boolean(enabled)
        log({ tag: 'collections-api', step: 'update-accepting-from-enabled', operationId, id, from: collections[collectionIndex].accepting, to: val })
        collections[collectionIndex].accepting = val
        // keep legacy field in sync for older clients
        collections[collectionIndex].enabled = val
        changes.accepting = val
        changes.enabled = val
      }

      if (accepting !== undefined) {
        const val = Boolean(accepting)
        log({ tag: 'collections-api', step: 'update-accepting', operationId, id, from: collections[collectionIndex].accepting, to: val })
        collections[collectionIndex].accepting = val
        collections[collectionIndex].enabled = val
        changes.accepting = val
        changes.enabled = val
      }

      if (renewalEnabled !== undefined) {
        const val = Boolean(renewalEnabled)
        log({ tag: 'collections-api', step: 'update-renewal', operationId, id, from: collections[collectionIndex].renewalEnabled, to: val })
        collections[collectionIndex].renewalEnabled = val
        changes.renewalEnabled = val
      }

      if (display !== undefined) {
        const val = Boolean(display)
        log({ tag: 'collections-api', step: 'update-display', operationId, id, to: val })
        if (val === true) {
          // ensure only one display=true
          for (let i = 0; i < collections.length; i++) {
            collections[i].display = (i === collectionIndex)
          }
        } else {
          collections[collectionIndex].display = false
        }
        changes.display = val
      }

      log({ tag: 'collections-api', step: 'save-start', operationId })
      const success = await saveCollections(collections)
      log({ tag: 'collections-api', step: 'save-result', operationId, success })

      if (!success) {
        return NextResponse.json(
          { error: 'Failed to update collection' },
          { status: 500 }
        )
      }

      // ✅ NEW: Verify consistency before proceeding with snapshot operations
      const consistencyOk = await verifyConsistency(id, changes, 5)
      if (!consistencyOk) {
        log({ tag: 'collections-api', step: 'consistency-timeout', operationId, id })
        // Don't fail the response, just warn - changes are in DB, eventual consistency will happen
      }

      // If display collection changed, auto-publish snapshot and invalidate cache
      // This ensures catalog refreshes instantly when a different collection is selected
      if (display === true) {
        try {
          const { withSnapshotLock } = await import('@/lib/snapshot-lock')
          const { invalidateClubsCache } = await import('@/lib/cache-utils')
          
          log({ tag: 'collections-api', step: 'publishing-snapshot', operationId, collectionId: collections[collectionIndex].id })
          
          const snapshotPublishOk = await withSnapshotLock(async () => {
            const displayCollection = collections.find(c => c.display)
            if (!displayCollection) return false

            const { listPaths } = await import('@/lib/supabase')
            const { readJSONFromStorage } = await import('@/lib/supabase')
            const regPaths = await listPaths(`registrations/${displayCollection.id}`)
            const jsonPaths = regPaths.filter(p => p.endsWith('.json'))
            
            const registrationPromises = jsonPaths.map(path => readJSONFromStorage(path))
            const allRegs = await Promise.all(registrationPromises)
            
            const registrations: ClubRegistration[] = allRegs.filter(
              reg => reg && typeof reg === 'object' && reg.status === 'approved'
            )

            registrations.sort((a, b) => {
              const timeA = a.approvedAt ? new Date(a.approvedAt).getTime() : new Date(a.submittedAt).getTime()
              const timeB = b.approvedAt ? new Date(b.approvedAt).getTime() : new Date(b.submittedAt).getTime()
              return timeB - timeA
            })

            const clubs: Club[] = registrations.map((r) => ({
              id: r.id,
              name: r.clubName,
              category: r.category || '',
              description: r.statementOfPurpose,
              advisor: r.advisorName,
              studentLeader: r.studentContactName,
              meetingTime: r.meetingDay,
              meetingFrequency: r.meetingFrequency,
              location: r.location,
              contact: r.studentContactEmail,
              socialMedia: r.socialMedia || '',
              active: true,
              notes: r.notes || '',
              announcement: '',
              keywords: [],
            }))

            const snapshot = {
              clubs,
              metadata: {
                generatedAt: new Date().toISOString(),
                clubCount: clubs.length,
                collectionId: displayCollection.id,
                collectionName: displayCollection.name,
              }
            }

            const { writeJSONToStorage } = await import('@/lib/supabase')
            const writeOk = await writeJSONToStorage('settings/clubs-snapshot.json', snapshot)
            if (!writeOk) {
              throw new Error('Snapshot write failed')
            }
            log({ tag: 'collections-api', step: 'snapshot-published', operationId, count: clubs.length })
            return true
          })
          
          // Only invalidate cache if snapshot publish succeeded
          if (snapshotPublishOk) {
            invalidateClubsCache()
            log({ tag: 'collections-api', step: 'cache-invalidated', operationId })
          } else {
            // ✅ NEW: Properly propagate snapshot publish failure
            log({ tag: 'collections-api', step: 'snapshot-publish-failed', operationId })
            return NextResponse.json({
              success: false,
              error: 'Collection display set but catalog snapshot failed to publish. Please manually publish the catalog.'
            }, { status: 500 })
          }
        } catch (err) {
          console.error('[collections-api] Failed to auto-publish snapshot:', err)
          // ✅ NEW: Return error instead of silently swallowing it
          log({ tag: 'collections-api', step: 'snapshot-error', operationId, error: String(err) })
          return NextResponse.json({
            success: false,
            error: 'Collection display set but catalog snapshot failed to publish. Please manually publish the catalog.'
          }, { status: 500 })
        }
      }

      log({ tag: 'collections-api', step: 'done', operationId, id: collections[collectionIndex].id })
      return NextResponse.json({ success: true, collection: collections[collectionIndex] })
    } catch (error) {
      log({ tag: 'collections-api', step: 'error', operationId, error: String(error) })
      return NextResponse.json(
        { error: 'Internal server error', detail: String(error) },
        { status: 500 }
      )
    }
  })
}

// DELETE - Delete collection (and optionally its registrations)
export async function DELETE(request: NextRequest) {
  const operationId = `DELETE-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`

  return collectionsLock.withLock(operationId, async () => {
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
      const id = searchParams.get('id')
      const deleteRegistrations = searchParams.get('deleteRegistrations') === 'true'

      if (!id) {
        return NextResponse.json(
          { error: 'Collection ID is required' },
          { status: 400 }
        )
      }

      log({ tag: 'collections-api', step: 'delete-start', operationId, id })

      const collections = await getCollections()
      const collectionIndex = collections.findIndex(c => c.id === id)

      if (collectionIndex === -1) {
        return NextResponse.json(
          { error: 'Collection not found' },
          { status: 404 }
        )
      }

      const collection = collections[collectionIndex]

      // Always delete associated registrations to prevent orphaned files
      // (don't wait for explicit deleteRegistrations flag)
      let cleanupSuccess = true
      try {
        const paths = await listPaths(`registrations/${collection.id}`)
        if (paths.length > 0) {
          const result = await removePaths(paths)
          if (result.removed !== paths.length) {
            console.error(
              `[DELETE collection] Cleanup failed: removed ${result.removed}/${paths.length} registrations. Collection deletion cancelled.`,
              result
            )
            cleanupSuccess = false
          } else {
            log({ tag: 'collections-api', step: 'deleted-registrations', count: paths.length, collectionId: collection.id })
          }
        }
      } catch (err) {
        console.error('[DELETE collection] Exception deleting registrations:', err)
        cleanupSuccess = false
      }

      if (!cleanupSuccess) {
        return NextResponse.json(
          { error: 'Could not delete all registrations. Collection deletion cancelled to prevent orphaned files.' },
          { status: 500 }
        )
      }

      // Remove collection from list (only if cleanup succeeded)
      collections.splice(collectionIndex, 1)
      const success = await saveCollections(collections)

      if (!success) {
        return NextResponse.json(
          { error: 'Failed to delete collection' },
          { status: 500 }
        )
      }

      log({ tag: 'collections-api', step: 'delete-done', operationId, id })
      return NextResponse.json({ success: true })
    } catch (error) {
      console.error('Error deleting collection:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  })
}
