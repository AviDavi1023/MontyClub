/**
 * EXAMPLE: Converting an existing API route to use cache infrastructure
 * 
 * This shows before/after for a typical registration approval endpoint
 * Use this as a template when migrating other endpoints in Phase 2
 */

// ============================================================================
// BEFORE: Traditional approach (susceptible to lost updates)
// ============================================================================

/*
import { NextRequest, NextResponse } from 'next/server'
import { readJSONFromStorage, writeJSONToStorage } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const data = await readJSONFromStorage('registrations.json')
    return NextResponse.json(data || [])
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { id, status } = await request.json()
    
    // PROBLEM: Multiple concurrent requests can read the same state
    const registrations = await readJSONFromStorage('registrations.json') || []
    
    const index = registrations.findIndex(r => r.id === id)
    if (index === -1) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    
    registrations[index].status = status
    
    // PROBLEM: Concurrent writes can overwrite each other
    await writeJSONToStorage('registrations.json', registrations)
    
    return NextResponse.json({ success: true, data: registrations[index] })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}
*/

// ============================================================================
// AFTER: Cache-backed approach (prevents lost updates)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { readJSONFromStorage, writeJSONToStorage } from '@/lib/supabase'

// Example type definition
interface Registration {
  id: string
  status: string
  [key: string]: any
}

import { createCache } from '@/lib/api-cache'
import { 
  createCachedGET, 
  createLockedPATCH, 
  validateAdminAuth,
  badRequestResponse,
  notFoundResponse
} from '@/lib/api-patterns'

export const dynamic = 'force-dynamic'

// Step 1: Create module-level cache (shared across all requests)
const registrationsCache = createCache<Registration[]>('registrations')

// Step 2: Replace GET with cached version
export const GET = createCachedGET(
  registrationsCache,
  async (request: NextRequest) => {
    // This only runs on cache miss
    const data = await readJSONFromStorage('registrations.json')
    return data || []
  },
  { maxAge: 10000 } // Cache for 10 seconds
)

// Step 3: Replace PATCH with locked version
export const PATCH = createLockedPATCH(registrationsCache, async (request: NextRequest) => {
  // Validate authentication
  if (!validateAdminAuth(request)) {
    throw new Error('Unauthorized')
  }

  const body = await request.json()
  const { id, status } = body

  if (!id || !status) {
    throw new Error('Missing required fields')
  }

  // Read from cache first (faster, consistent); fall back to storage
  let registrations: Registration[] = registrationsCache.get() ?? (await readJSONFromStorage('registrations.json')) ?? []
  if (!Array.isArray(registrations)) {
    registrations = []
  }

  // Find and update
  const index = registrations.findIndex(r => r.id === id)
  if (index === -1) {
    throw new Error('Registration not found')
  }

  registrations[index].status = status

  // Save to storage
  const success = await writeJSONToStorage('registrations.json', registrations)
  if (!success) {
    throw new Error('Failed to save to storage')
  }

  // CRITICAL: Update cache after successful write (now guaranteed non-null array)
  registrationsCache.set(registrations as Registration[])

  return { 
    success: true, 
    registration: registrations[index] 
  }
})

// ============================================================================
// Key Improvements:
// ============================================================================
// 
// 1. ✅ Lock prevents concurrent PATCHes from racing
// 2. ✅ Cache ensures consistent read-modify-write
// 3. ✅ GET returns fresh data without storage delay
// 4. ✅ Automatic retry and error handling
// 5. ✅ Consistent logging and monitoring
// 6. ✅ Type-safe responses
//
// ============================================================================

// ============================================================================
// Frontend Integration Example
// ============================================================================

/*
import { usePendingChanges } from '@/lib/use-pending-changes'

export function RegistrationsList() {
  const [registrations, setRegistrations] = useState<Registration[]>([])
  
  // Step 1: Setup pending changes hook
  const [pendingChanges, setPendingChanges, loaded] = usePendingChanges<{
    status?: string
  }>({
    primaryKey: 'myapp:pendingRegistrations',
    backupKey: 'myapp:pendingRegistrations:backup',
    logTag: 'registrations'
  })

  // Step 2: Auto-clear when server syncs
  useEffect(() => {
    if (!loaded || Object.keys(pendingChanges).length === 0) return

    const stillPending = { ...pendingChanges }
    let hasCleared = false

    Object.keys(stillPending).forEach(id => {
      const serverItem = registrations.find(r => r.id === id)
      const pending = stillPending[id]

      if (serverItem && serverItem.status === pending.status) {
        delete stillPending[id]
        hasCleared = true
      }
    })

    if (hasCleared) {
      setPendingChanges(stillPending)
    }
  }, [registrations, pendingChanges, loaded])

  // Step 3: Optimistic update handler
  const handleApprove = async (id: string) => {
    // Immediate UI update
    setPendingChanges(prev => ({
      ...prev,
      [id]: { status: 'approved' }
    }))

    try {
      const resp = await fetch('/api/registrations', {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-key': adminApiKey 
        },
        body: JSON.stringify({ id, status: 'approved' })
      })

      if (!resp.ok) throw new Error('Failed')
      
      // Success - keep pending until auto-clear detects it
    } catch (error) {
      // Revert on error
      setPendingChanges(prev => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      alert('Failed to approve')
    }
  }

  // Step 4: Merge pending with server data for display
  const displayedRegistrations = registrations.map(reg => {
    const pending = pendingChanges[reg.id]
    return pending ? { ...reg, ...pending } : reg
  })

  return (
    <div>
      {displayedRegistrations.map(reg => (
        <div key={reg.id}>
          <span>{reg.status}</span>
          {pendingChanges[reg.id] && <span className="text-gray-500">Syncing...</span>}
          <button onClick={() => handleApprove(reg.id)}>Approve</button>
        </div>
      ))}
    </div>
  )
}
*/

// ============================================================================
// Migration Checklist
// ============================================================================
//
// Backend:
// [ ] Import cache utilities from @/lib/api-cache and @/lib/api-patterns
// [ ] Create module-level cache instance
// [ ] Convert GET to use createCachedGET
// [ ] Convert PATCH/POST/DELETE to use createLocked* functions
// [ ] Update cache after successful writes
// [ ] Add proper error handling
// [ ] Test concurrent requests
//
// Frontend:
// [ ] Import usePendingChanges hook
// [ ] Setup pending state with appropriate keys
// [ ] Implement auto-clear effect
// [ ] Update handlers to do optimistic updates
// [ ] Merge pending with server data for display
// [ ] Show "Syncing..." indicator
// [ ] Handle errors with revert
//
// ============================================================================
