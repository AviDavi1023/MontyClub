# API Cache & Pending Changes Infrastructure

This directory contains reusable utilities for implementing consistent, cache-backed API endpoints with optimistic UI updates. These patterns prevent lost updates from concurrent requests and eventual consistency issues with distributed storage systems.

## Architecture Overview

### Backend (API Routes)
- **`api-cache.ts`**: Generic in-memory cache manager with locking mechanism
- **`api-patterns.ts`**: Reusable patterns for GET/POST/PATCH/DELETE handlers

### Frontend (React Components)
- **`use-pending-changes.ts`**: React hooks for localStorage-backed optimistic updates

## Quick Start Guide

### Backend: Creating a Cache-Backed API Route

#### Step 1: Create a cache instance

```typescript
// app/api/my-resource/route.ts
import { createCache } from '@/lib/api-cache'
import { MyResource } from '@/types'

// Module-level cache (shared across all requests to this route)
const resourceCache = createCache<MyResource[]>('my-resource')
```

#### Step 2: Implement GET handler

```typescript
import { createCachedGET } from '@/lib/api-patterns'
import { readJSONFromStorage } from '@/lib/supabase'

export const GET = createCachedGET(
  resourceCache,
  async (request) => {
    // If cache exists, it will be returned automatically
    // This function only runs on cache miss
    const data = await readJSONFromStorage('path/to/resource.json')
    return data || []
  },
  { maxAge: 10000 } // Cache valid for 10 seconds
)
```

#### Step 3: Implement PATCH handler with locking

```typescript
import { createLockedPATCH, validateAdminAuth, unauthorizedResponse } from '@/lib/api-patterns'

export const PATCH = createLockedPATCH(resourceCache, async (request) => {
  // Validate auth
  if (!validateAdminAuth(request)) {
    throw new Error('Unauthorized')
  }

  const body = await request.json()
  const { id, ...updates } = body

  // Read current data (prefer cache)
  let data = resourceCache.get() || await readJSONFromStorage('path/to/resource.json')
  
  // Modify data
  const index = data.findIndex(item => item.id === id)
  if (index === -1) {
    throw new Error('Not found')
  }
  
  data[index] = { ...data[index], ...updates }

  // Save to storage
  const success = await writeJSONToStorage('path/to/resource.json', data)
  if (!success) {
    throw new Error('Failed to save')
  }

  // Update cache
  resourceCache.set(data)

  return { success: true, data: data[index] }
})
```

### Frontend: Using Optimistic Updates

#### Step 1: Set up pending changes hook

```typescript
import { usePendingChanges } from '@/lib/use-pending-changes'

function MyComponent() {
  const [pendingChanges, setPendingChanges, loaded] = usePendingChanges<{
    status?: string
    deleted?: boolean
  }>({
    primaryKey: 'myapp:pending',
    backupKey: 'myapp:pending:backup',
    logTag: 'my-feature',
    debug: true
  })

  // ... rest of component
}
```

#### Step 2: Implement optimistic update

```typescript
const handleUpdate = async (id: string, newStatus: string) => {
  // 1. Optimistically update localStorage
  setPendingChanges(prev => ({
    ...prev,
    [id]: { status: newStatus }
  }))

  try {
    // 2. Send API request
    const resp = await fetch('/api/my-resource', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: newStatus })
    })

    if (!resp.ok) throw new Error('Failed')

    // 3. Success! Keep pending until auto-clear detects it
    showToast('Updated successfully')
  } catch (error) {
    // 4. On error, revert the optimistic update
    setPendingChanges(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    showToast('Update failed', 'error')
  }
}
```

#### Step 3: Auto-clear when synced

```typescript
useEffect(() => {
  if (!loaded || Object.keys(pendingChanges).length === 0) return

  const stillPending = { ...pendingChanges }
  let hasCleared = false

  Object.keys(stillPending).forEach(id => {
    const serverItem = serverData.find(item => item.id === id)
    const pending = stillPending[id]

    // Clear if server state matches pending
    if (serverItem && serverItem.status === pending.status) {
      delete stillPending[id]
      hasCleared = true
    }
  })

  if (hasCleared) {
    setPendingChanges(stillPending)
  }
}, [serverData, pendingChanges, loaded])
```

## Complete Example: Registration Approvals

### Backend (`app/api/registrations/route.ts`)

```typescript
import { NextRequest } from 'next/server'
import { createCache } from '@/lib/api-cache'
import { createCachedGET, createLockedPATCH, validateAdminAuth } from '@/lib/api-patterns'
import { readJSONFromStorage, writeJSONToStorage } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const registrationsCache = createCache<Registration[]>('registrations')

// GET - List all registrations (uses cache)
export const GET = createCachedGET(
  registrationsCache,
  async () => {
    const data = await readJSONFromStorage('registrations.json')
    return data || []
  }
)

// PATCH - Approve/deny registration (locked)
export const PATCH = createLockedPATCH(registrationsCache, async (request: NextRequest) => {
  if (!validateAdminAuth(request)) {
    throw new Error('Unauthorized')
  }

  const { id, status } = await request.json()
  
  // Read from cache or storage
  let registrations = registrationsCache.get() || await readJSONFromStorage('registrations.json') || []
  
  const index = registrations.findIndex(r => r.id === id)
  if (index === -1) throw new Error('Not found')
  
  registrations[index].status = status
  
  // Save and update cache
  await writeJSONToStorage('registrations.json', registrations)
  registrationsCache.set(registrations)
  
  return { success: true, registration: registrations[index] }
})
```

### Frontend (`components/RegistrationsList.tsx`)

```typescript
import { usePendingChanges } from '@/lib/use-pending-changes'

export function RegistrationsList() {
  const [registrations, setRegistrations] = useState([])
  const [pendingChanges, setPendingChanges, loaded] = usePendingChanges({
    primaryKey: 'myapp:pendingRegistrations',
    backupKey: 'myapp:pendingRegistrations:backup',
    logTag: 'registrations'
  })

  // Auto-clear when synced
  useEffect(() => {
    if (!loaded || !registrations.length) return
    
    const stillPending = { ...pendingChanges }
    let cleared = false

    Object.keys(stillPending).forEach(id => {
      const server = registrations.find(r => r.id === id)
      if (server && server.status === stillPending[id].status) {
        delete stillPending[id]
        cleared = true
      }
    })

    if (cleared) setPendingChanges(stillPending)
  }, [registrations, pendingChanges, loaded])

  // Merge server data with pending changes for display
  const displayed = registrations.map(reg => {
    const pending = pendingChanges[reg.id]
    return pending ? { ...reg, ...pending } : reg
  })

  const handleApprove = async (id: string) => {
    // Optimistic update
    setPendingChanges(prev => ({ ...prev, [id]: { status: 'approved' } }))

    try {
      await fetch('/api/registrations', {
        method: 'PATCH',
        body: JSON.stringify({ id, status: 'approved' })
      })
    } catch (err) {
      // Revert on error
      setPendingChanges(prev => {
        const next = { ...prev }
        delete next[id]
        return next
      })
    }
  }

  return (
    <div>
      {displayed.map(reg => (
        <div key={reg.id}>
          {reg.status}
          {pendingChanges[reg.id] && <span>Syncing...</span>}
        </div>
      ))}
    </div>
  )
}
```

## Key Patterns & Best Practices

### 1. Cache Invalidation Strategy

The cache uses **time-based invalidation** (default: 10 seconds). This ensures:
- Rapid consecutive requests get cached data
- Stale data is refreshed after the timeout
- No manual invalidation needed

### 2. Lock Mechanism

The `withLock()` method ensures:
- Serial execution of PATCH/POST/DELETE operations
- No lost updates from concurrent requests
- Consistent cache state

### 3. Optimistic Updates

Always follow this pattern:
1. Update localStorage immediately (optimistic)
2. Send API request
3. On success: keep pending until auto-clear
4. On error: revert localStorage

### 4. Auto-Clear Logic

The auto-clear effect should:
- Only run after localStorage is loaded
- Compare server state with pending changes
- Clear when they match
- Handle deletions (item not in server = clear)

### 5. Error Handling

```typescript
try {
  // Update localStorage
  setPending(...)
  
  // API call
  const resp = await fetch(...)
  if (!resp.ok) throw new Error()
  
  // Success - keep pending
} catch (error) {
  // Revert localStorage
  setPending(prev => {
    const next = { ...prev }
    delete next[id]
    return next
  })
}
```

## Migration Checklist

When converting an existing endpoint:

### Backend
- [ ] Create cache instance at module level
- [ ] Convert GET to use `createCachedGET`
- [ ] Convert PATCH to use `createLockedPATCH`
- [ ] Ensure cache is updated after successful writes
- [ ] Add proper error handling

### Frontend
- [ ] Replace manual localStorage with `usePendingChanges` hook
- [ ] Implement optimistic update pattern
- [ ] Add auto-clear effect
- [ ] Merge pending changes with server data for display
- [ ] Show "Syncing..." indicator when pending

## Troubleshooting

### Issue: Changes not persisting
- Check that cache is updated after write: `cache.set(data)`
- Verify storage write was successful
- Check console logs for cache hits/misses

### Issue: Lost updates with rapid changes
- Ensure PATCH uses `createLockedPATCH`
- Verify cache exists before modifying
- Check that operations are serialized (logs show lock-acquired)

### Issue: UI stuck in "Syncing..."
- Check auto-clear logic is running
- Verify server data is being fetched
- Check that pending changes match server format exactly
- Look for errors in browser console

### Issue: Concurrent requests overwriting each other
- Add `export const dynamic = 'force-dynamic'` to route
- Ensure cache is module-level (not inside handler)
- Verify lock is working (check console logs)

## Performance Considerations

- **Cache hit rate**: Monitor with `cache.getMetrics()`
- **Lock contention**: Serial execution may slow down under heavy load
- **Memory usage**: Cache is in-memory per server instance
- **LocalStorage size**: Keep pending changes minimal

## Future Enhancements

Potential improvements for v2:
- Distributed cache (Redis) for multi-instance deployments
- Optimistic locking with version numbers
- Conflict resolution UI
- Automatic retry with exponential backoff
- WebSocket-based real-time sync
