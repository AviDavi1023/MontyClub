# Priority Fixes & Implementation Guide

## PRIORITY 1: CRITICAL DATA INTEGRITY ISSUES

### Fix #1: Collection Deletion Must Validate Cleanup Success
**File**: `app/api/registration-collections/route.ts`  
**Lines**: ~430-445  
**Time**: 30 minutes

**Current Code**:
```typescript
try {
  const paths = await listPaths(`registrations/${collection.id}`)
  if (paths.length > 0) {
    await removePaths(paths)
  }
} catch (err) {
  console.error('Error deleting registrations:', err)
  // CONTINUES! ← BUG
}

collections.splice(collectionIndex, 1)
```

**Fix**:
```typescript
let cleanupSuccess = true
try {
  const paths = await listPaths(`registrations/${collection.id}`)
  if (paths.length > 0) {
    const result = await removePaths(paths)
    if (result.removed !== paths.length) {
      // Partial failure
      console.error(
        `[DELETE collection] Cleanup failed: removed ${result.removed}/${paths.length} registrations`
      )
      cleanupSuccess = false
    }
  }
} catch (err) {
  console.error('[DELETE collection] Cleanup exception:', err)
  cleanupSuccess = false
}

if (!cleanupSuccess) {
  return NextResponse.json(
    {
      error: 'Could not delete all registrations. Collection deletion cancelled to prevent orphaned files.'
    },
    { status: 500 }
  )
}

// Only proceed if cleanup succeeded
collections.splice(collectionIndex, 1)
const success = await saveCollections(collections)
```

---

### Fix #2: Register All Registration Mutations Under Same Lock
**Files**: 
- `app/api/registration-approve/route.ts`
- `app/api/registration-deny/route.ts`
- `app/api/registration-update/route.ts`
- `app/api/registration-delete/route.ts`

**Time**: 1 hour

**Problem**: Different routes don't coordinate. Need shared lock infrastructure.

**Solution**: Create `lib/registration-lock.ts`:
```typescript
// lib/registration-lock.ts
const registrationLocks = new Map<string, Promise<any>>()

export async function withRegistrationLock<R>(
  registrationPath: string,
  fn: () => Promise<R>
): Promise<R> {
  const operationId = `${registrationPath}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
  
  // Get current lock for this registration, or resolve immediately
  const currentLock = registrationLocks.get(registrationPath) || Promise.resolve()
  
  // Create new lock that waits for current one
  const newLock = (async () => {
    await currentLock.catch(() => {})
    return await fn()
  })()
  
  // Update lock for next operation
  registrationLocks.set(registrationPath, newLock.catch(() => {}))
  
  return newLock
}

// Cleanup old locks every hour
setInterval(() => {
  const now = Date.now()
  for (const [key] of registrationLocks.entries()) {
    if (key.includes(`-${now - 3600000}-`)) {
      registrationLocks.delete(key)
    }
  }
}, 3600000)
```

Then update each route:
```typescript
// registration-approve/route.ts
import { withRegistrationLock } from '@/lib/registration-lock'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { registrationId, collection } = body
  const path = `registrations/${collection}/${registrationId}.json`
  
  return withRegistrationLock(path, async () => {
    // Existing approval logic here
    // Now guaranteed no concurrent updates
  })
}
```

---

### Fix #3: Remove Approval Cache (It's Wrong)
**File**: `app/api/registration-approve/route.ts`  
**Lines**: ~45-50  
**Time**: 15 minutes

**Current**:
```typescript
const cache = registrationActionsCache.get() || {}
cache[path] = { status: 'approved', timestamp: Date.now() }
registrationActionsCache.set(cache)
```

**Remove Entirely** — The cache is per-instance and misleads about approval state. Let me check if it's used elsewhere...

If only used in registration-approve/deny, delete these lines entirely. The approval write to storage is the source of truth; no caching needed.

---

## PRIORITY 2: HIGH-IMPACT RACE CONDITIONS

### Fix #4: Display Toggle Must Read Fresh State
**File**: `app/api/registration-collections/route.ts`  
**Lines**: ~273-283  
**Time**: 45 minutes

**Problem**: Lock doesn't help if data is stale before lock is acquired.

**Solution**: Move the "only one display=true" enforcement to a separate atomic operation:

```typescript
// PATCH /api/registration-collections
if (display !== undefined && display === true) {
  // Atomic operation: ensure no other collection has display=true
  const success = await enforceUniqueDisplay(collectionIndex, collections)
  if (!success) {
    return NextResponse.json(
      { error: 'Display state changed during update. Please refresh and try again.' },
      { status: 409 }
    )
  }
} else if (display === false) {
  collections[collectionIndex].display = false
}
```

Alternatively, simpler fix: Don't allow display to be false via PATCH, only true (which auto-unsets others):

```typescript
if (display === true) {
  // ensure only one display=true
  for (let i = 0; i < collections.length; i++) {
    collections[i].display = (i === collectionIndex)
  }
}
// display=false is not allowed via PATCH (just skip it)
```

---

### Fix #5: Validate Collection Slug Before Optimistic Update
**File**: `components/AdminPanel.tsx`  
**Lines**: ~480-510 (createCollection function)  
**Time**: 30 minutes

**Current**: Frontend creates with name, server checks slug collision later.

**Fix**:
```typescript
const createCollection = async () => {
  if (!adminApiKey || !newCollectionName.trim()) {
    showToast('Enter collection name', 'error')
    return
  }
  
  // NEW: Check slug collision before optimistic update
  const { slugifyName } = await import('@/lib/slug')
  const newSlug = slugifyName(newCollectionName.trim())
  const slugConflict = collections.find(c => {
    const cSlug = slugifyName(c.name)
    return cSlug === newSlug
  })
  
  if (slugConflict) {
    showToast(
      `Name would conflict with existing collection "${slugConflict.name}". Choose a different name.`,
      'error'
    )
    return
  }
  
  // Now safe to proceed with optimistic update
  const tempId = `temp-col-${Date.now()}`
  // ... rest of creation logic
}
```

---

## PRIORITY 3: SECURITY & STORAGE

### Fix #6: Encrypt Admin API Key
**File**: `components/AdminPanel.tsx`  
**Lines**: ~160-170, ~918-925  
**Time**: 2 hours

**Option A: Disable localStorage Persistence** (simplest, safest)
```typescript
const saveAdminApiKey = () => {
  const k = adminApiKey.trim()
  setAdminApiKey(k)
  // Remove: localStorage.setItem('analytics:adminKey', k)
  showToast('Admin API key saved to session (not persisted)')
}

// On logout/unload, clear state
const handleLogout = () => {
  setAdminApiKey('')
  setIsAuthenticated(false)
  // ... rest of logout
}
```

**Option B: Use Encrypted Session Storage** (better, but more complex)
```typescript
import crypto from 'subtle' // Requires Web Crypto API

const saveAdminApiKeyEncrypted = async () => {
  const k = adminApiKey.trim()
  
  // Generate random IV
  const iv = crypto.getRandomValues(new Uint8Array(12))
  
  // Use admin password as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(currentUser + password), // Derive from login
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  )
  
  // Encrypt
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    keyMaterial,
    new TextEncoder().encode(k)
  )
  
  // Store iv + ciphertext
  sessionStorage.setItem('admin:apikey', 
    JSON.stringify({
      iv: Array.from(iv),
      data: Array.from(new Uint8Array(encrypted))
    })
  )
}
```

**Recommendation**: Go with Option A (disable persistence). Admin must enter key once per session.

---

### Fix #7: Use Proper Input Types for Sensitive Fields
**File**: `components/AdminPanel.tsx`  
**Lines**: ~3550-3565  
**Time**: 15 minutes

**Current**:
```html
<input type="password" value={clearDataPassword} ... />
<input type="password" value={apiKeyPromptInput} ... placeholder="Enter your ADMIN_API_KEY" />
```

**Fix**:
```html
<!-- Password field -->
<input 
  type="password"
  value={clearDataPassword}
  placeholder="Enter admin password"
  autoComplete="current-password"
/>

<!-- API Key field — use text not password, so it doesn't confuse password managers -->
<input
  type="text"
  value={apiKeyPromptInput}
  placeholder="Enter your ADMIN_API_KEY"
  spellCheck="false"
  autoComplete="off"
/>
```

---

## PRIORITY 4: USABILITY & CLARITY

### Fix #8: Rename Collection Flags for Clarity
**Files**: 
- `types/club.ts`
- `app/api/registration-collections/route.ts`
- `components/AdminPanel.tsx`
- `components/RegistrationsList.tsx`

**Time**: 3 hours (needs frontend + backend coordination)

**Current Names** → **Better Names**:
```typescript
export interface RegistrationCollection {
  id: string
  name: string
  createdAt: string
  
  // OLD NAMES          NEW NAMES
  enabled         →    registrationOpen     // Can users submit new clubs?
  display         →    showcaseInCatalog    // Should approved clubs be visible?
  accepting       →    (remove, same as enabled)
  renewalEnabled  →    renewalFormActive    // Can clubs renew?
}
```

**Migration Strategy**:
1. Keep old field names in storage for back-compat
2. Add new field names
3. Always sync: `registrationOpen = enabled`
4. In admin UI, use new names with tooltips
5. After 3 months, deprecate old names

**Tooltip Examples**:
```
📚 Registration Open
   When enabled, admin panel accepts new club charter requests
   
📺 Showcase in Catalog
   When enabled, approved clubs from this collection appear in the public catalog
   
🔄 Renewal Form Active
   When enabled, existing clubs can renew their information
```

---

### Fix #9: Add Pending Changes Loader to RegistrationsList
**File**: `components/RegistrationsList.tsx`  
**Lines**: ~110-150  
**Time**: 30 minutes

**Add useEffect to sync pending changes from localStorage**:
```typescript
useEffect(() => {
  const loadPendingRegistrations = () => {
    try {
      const pending = localStorage.getItem(REGISTRATIONS_PENDING_KEY)
      if (pending) {
        const parsed = JSON.parse(pending)
        setLocalPendingRegistrationChanges(parsed)
      }
    } catch (e) {
      console.error('Failed to load pending registrations:', e)
    }
  }
  
  loadPendingRegistrations()
  
  // Also listen for storage changes from other tabs
  const handleStorageChange = (e: StorageEvent) => {
    if (e.key === REGISTRATIONS_PENDING_KEY) {
      loadPendingRegistrations()
    }
  }
  
  window.addEventListener('storage', handleStorageChange)
  return () => window.removeEventListener('storage', handleStorageChange)
}, [])
```

---

## PRIORITY 5: OBSERVABILITY & ERROR HANDLING

### Fix #10: Improve removePaths() Error Reporting
**File**: `lib/supabase.ts`  
**Lines**: ~144-155  
**Time**: 15 minutes

**Current**:
```typescript
export async function removePaths(paths: string[]) {
  try {
    const { data, error } = await client.storage.from('club-data').remove(paths)
    if (error) {
      console.warn('Error removing from Supabase:', error)
      return { removed: 0 }  // ← Hides partial deletions
    }
    return { removed: data?.length || 0 }
  }
}
```

**Fix**:
```typescript
export async function removePaths(paths: string[]) {
  if (!paths || paths.length === 0) {
    return { removed: 0, total: 0, failed: 0, error: null }
  }
  
  try {
    const { data, error } = await client.storage.from('club-data').remove(paths)
    if (error) {
      console.error('[removePaths] Error from Supabase:', error.message)
      return {
        removed: 0,
        total: paths.length,
        failed: paths.length,
        error: error.message
      }
    }
    
    // data is array of successfully removed paths
    const removed = data?.length || 0
    const failed = paths.length - removed
    
    if (failed > 0) {
      console.warn(
        `[removePaths] Partial failure: removed ${removed}/${paths.length}`,
        { failedPaths: paths.slice(removed) }
      )
    }
    
    return {
      removed,
      total: paths.length,
      failed,
      error: failed > 0 ? `${failed} files not removed` : null
    }
  } catch (e) {
    console.error('[removePaths] Exception:', e)
    return {
      removed: 0,
      total: paths.length,
      failed: paths.length,
      error: String(e)
    }
  }
}
```

Then in DELETE /api/registration-collections:
```typescript
const result = await removePaths(paths)
if (result.failed > 0) {
  console.error(
    `[DELETE collection] Cleanup failure: ${result.failed}/${result.total} registrations remain`
  )
  // Return error instead of continuing
  return NextResponse.json(
    { error: 'Could not delete all registrations. Collection deletion cancelled.' },
    { status: 500 }
  )
}
```

---

## TESTING CHECKLIST

After implementing fixes, test:

```
□ ISSUE #1: Delete collection while simulating Supabase timeout
  - Verify deletion is rejected
  - Verify files remain in storage
  
□ ISSUE #2: Approve registration, immediately edit it
  - Verify approval is not lost
  - Verify both changes are preserved
  
□ ISSUE #3: Open admin panel in 2 tabs, toggle display in both simultaneously
  - Verify final state is consistent
  - Verify only one collection has display=true
  
□ ISSUE #4: Create collection, share registration link within 100ms
  - Verify registration submissions don't fail
  - Verify collection appears in UI
  
□ ISSUE #5: Admin API key is not persisted after logout
  - Verify key is cleared from localStorage
  - Verify next session requires re-entry
  
□ ISSUE #6: Create collection with name that slugs to existing collection
  - Verify frontend shows error before submission
  - Verify server also rejects if frontend was bypassed
```

---

## IMPLEMENTATION ORDER

Week 1:
1. Fix #1 (collection deletion) — 30 min
2. Fix #2 (registration locking) — 1 hour
3. Fix #3 (remove cache) — 15 min
4. Test #1, #2, #3

Week 2:
5. Fix #4 (display toggle) — 45 min
6. Fix #5 (slug validation) — 30 min
7. Fix #10 (error reporting) — 15 min
8. Test #4, #5, #10

Week 3:
9. Fix #6 (API key encryption) — 2 hours
10. Fix #7 (input types) — 15 min
11. Fix #9 (pending sync) — 30 min
12. Test #6, #7, #9

Week 4:
13. Fix #8 (naming clarification) — 3 hours
14. Full regression testing
15. Deploy to staging

**Total Time**: ~8 hours implementation + ~4 hours testing = ~12 hours

