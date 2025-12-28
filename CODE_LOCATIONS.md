# Code Location Reference - Issues & Fixes

## CRITICAL ISSUE #1: Orphaned Files on Collection Delete

### Current Problematic Code
**File**: `app/api/registration-collections/route.ts`  
**Lines**: 430-445  
**Function**: `DELETE` handler

```typescript
// CURRENT CODE (BUGGY)
try {
  const paths = await listPaths(`registrations/${collection.id}`)
  if (paths.length > 0) {
    await removePaths(paths)  // 🚨 Result ignored!
  }
} catch (err) {
  console.error('Error deleting registrations:', err)
  // 🚨 CONTINUES EXECUTION HERE
}

// This line executes regardless of cleanup success
collections.splice(collectionIndex, 1)
const success = await saveCollections(collections)
```

### Fix Location
**File**: Same (`app/api/registration-collections/route.ts`)  
**Action**: Replace lines 430-445  
**Implementation**: Add validation that cleanup succeeded before deletion

```typescript
// FIXED CODE
let cleanupSuccess = true
try {
  const paths = await listPaths(`registrations/${collection.id}`)
  if (paths.length > 0) {
    const result = await removePaths(paths)
    if (result.removed !== paths.length) {
      console.error(`Cleanup failed: removed ${result.removed}/${paths.length}`)
      cleanupSuccess = false
    }
  }
} catch (err) {
  console.error('Error deleting registrations:', err)
  cleanupSuccess = false
}

if (!cleanupSuccess) {
  return NextResponse.json({ error: 'Cleanup failed, collection not deleted' }, { status: 500 })
}

// Only proceed if cleanup succeeded
collections.splice(collectionIndex, 1)
const success = await saveCollections(collections)
```

---

## CRITICAL ISSUE #2: Registration Mutations Don't Share Locking

### Current Unprotected Routes
1. **`app/api/registration-update/route.ts`** (No lock) ❌
2. **`app/api/registration-delete/route.ts`** (No lock) ❌
3. **`app/api/registration-approve/route.ts`** (Has lock) ✓
4. **`app/api/registration-deny/route.ts`** (Has lock) ✓

### Problem Code Locations

**File**: `app/api/registration-update/route.ts`  
**Lines**: 1-41

```typescript
// PROBLEMATIC: No locking
export async function POST(request: NextRequest) {
  try {
    // ... validation ...
    
    const registration = await readJSONFromStorage(path)  // 🚨 Unprotected read
    Object.assign(registration, updates)                  // 🚨 Blind overwrite
    await writeJSONToStorage(path, registration)          // 🚨 No concurrency control
  }
}
```

**File**: `app/api/registration-delete/route.ts`  
**Lines**: 1-51

```typescript
// PROBLEMATIC: No locking
export async function POST(request: NextRequest) {
  try {
    // ... validation ...
    
    const path = `registrations/${collection}/${registrationId}.json`
    const result = await removePaths([path])  // 🚨 No locking around this
  }
}
```

### Fix: Create Shared Lock Utility

**File**: Create new `lib/registration-lock.ts`  
**Implementation**: See FIXES_RECOMMENDED.md

**Then Update Each Route**:

```typescript
// registration-update/route.ts
import { withRegistrationLock } from '@/lib/registration-lock'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { registrationId, collection, updates } = body
  const path = `registrations/${collection}/${registrationId}.json`
  
  return withRegistrationLock(path, async () => {
    // PROTECTED BLOCK
    const registration = await readJSONFromStorage(path)
    Object.assign(registration, updates)
    await writeJSONToStorage(path, registration)
    return NextResponse.json({ success: true })
  })
}
```

Apply same pattern to `registration-delete/route.ts`.

---

## CRITICAL ISSUE #3: Approval Cache Gives False Confidence

### Current Code
**File**: `app/api/registration-approve/route.ts`  
**Lines**: 45-50

```typescript
// PROBLEMATIC CODE
const cache = registrationActionsCache.get() || {}
cache[path] = { status: 'approved', timestamp: Date.now() }
registrationActionsCache.set(cache)

return NextResponse.json({ 
  success: true,
  message: 'Registration approved'
})
```

### Why It's Wrong
- In-memory cache on Instance A
- Request might come to Instance B next
- Instance B has no cache, reads stale Supabase
- Admin sees "still pending" → confusion

### Fix
**File**: Same  
**Action**: Delete lines 45-50 entirely

**Reasoning**: The write to Supabase is the source of truth. Don't cache.

---

## SIGNIFICANT RISK #1: Display Toggle Can Race in Multi-Tab

### Current Code
**File**: `app/api/registration-collections/route.ts`  
**Lines**: 273-283

```typescript
// PROBLEMATIC LOGIC
if (display !== undefined) {
  const val = Boolean(display)
  if (val === true) {
    // This assumes current state, but might be stale!
    for (let i = 0; i < collections.length; i++) {
      collections[i].display = (i === collectionIndex)
    }
  }
}
```

### The Race
1. Tab A reads stale collections
2. Tab B changes collections first
3. Tab A's write overwrites Tab B's change

### Fix Strategy
**File**: Same  
**Option 1**: Simpler - Only allow display=true, never false

```typescript
if (display === true) {
  // ensure only one display=true
  for (let i = 0; i < collections.length; i++) {
    collections[i].display = (i === collectionIndex)
  }
}
// Silently ignore display=false (already false)
```

**Option 2**: Better - Use version comparison

```typescript
// Add version field to track mutations
// Compare versions before writing
// Return 409 Conflict if version mismatch
```

---

## SIGNIFICANT RISK #2: Frontend Doesn't Validate Slug Collision

### Current Code
**File**: `components/AdminPanel.tsx`  
**Lines**: 410-450 (createCollection function)

```typescript
// PROBLEMATIC: No slug check before optimistic update
const tempId = `temp-col-${Date.now()}`

setLocalPendingCollectionChanges(prev => ({
  ...prev,
  [tempId]: { created: true, name: newCollectionName, enabled: false }
}))

// Then send to server (which validates, but no early rejection)
```

### Fix: Add Frontend Validation

**File**: Same  
**Lines**: Before setLocalPendingCollectionChanges

```typescript
// NEW CODE
const { slugifyName } = await import('@/lib/slug')
const newSlug = slugifyName(newCollectionName.trim())

// Check against existing collections
const slugConflict = collections.find(c => {
  const cSlug = slugifyName(c.name)
  return cSlug === newSlug
})

if (slugConflict) {
  showToast(
    `Name "${newCollectionName}" conflicts with existing collection "${slugConflict.name}". Choose a different name.`,
    'error'
  )
  return
}

// NOW safe to proceed with optimistic update
setLocalPendingCollectionChanges(...)
```

---

## SECURITY ISSUE: Admin API Key Stored in Plain Text

### Current Code Locations

**File**: `components/AdminPanel.tsx`  
**Line 918**: Save function

```typescript
const saveAdminApiKey = () => {
  const k = adminApiKey.trim()
  setAdminApiKey(k)
  try { localStorage.setItem('analytics:adminKey', k) } catch {}  // 🚨 PLAIN TEXT
  showToast('Admin API key saved')
}
```

**Line 169**: Initial load

```typescript
useEffect(() => {
  try {
    const key = localStorage.getItem('analytics:adminKey')
    if (key) setAdminApiKey(key)
  } catch {}
})
```

**Line 2464**: Prompt modal field

```html
<input
  type="password"
  value={apiKeyPromptInput}
  placeholder="Enter your ADMIN_API_KEY"
  className="input-field"
/>
```

### Fix: Don't Persist API Key

**File**: Same  
**Action 1**: Remove line 918 persistence
**Action 2**: Remove line 169 loading
**Action 3**: Change input type on line 2464

```typescript
// FIXED: Only store in memory during session
const saveAdminApiKey = () => {
  const k = adminApiKey.trim()
  setAdminApiKey(k)
  // Remove: localStorage.setItem()
  showToast('Admin API key saved (session only)')
}

// FIXED: Don't restore from storage
useEffect(() => {
  // Remove localStorage loading
}, [])

// FIXED: Use text input, not password
<input
  type="text"
  value={apiKeyPromptInput}
  placeholder="Enter your ADMIN_API_KEY"
  spellCheck="false"
  autoComplete="off"
/>
```

---

## DESIGN ISSUE: Confusing Flag Names

### Current Flag Names
**File**: `types/club.ts` - RegistrationCollection interface

```typescript
export interface RegistrationCollection {
  enabled: boolean        // Confusing: means what?
  display?: boolean       // Unclear what "display" means
  accepting?: boolean     // Seems same as enabled?
  renewalEnabled?: boolean // Clear
}
```

### Usage in API
**File**: `app/api/registration-collections/route.ts`  
**Lines**: 290-310

```typescript
// Back-compat nonsense:
if (enabled !== undefined && accepting === undefined) {
  collections[collectionIndex].accepting = val
  collections[collectionIndex].enabled = val  // Kept in sync
}
```

### Frontend Display
**File**: `components/RegistrationsList.tsx`  
**Lines**: ~950-1050 (Collection toggle buttons area)

Shows admin 4 checkboxes with no explanation of what each does.

### Fix: Rename for Clarity

**File**: `types/club.ts`

```typescript
export interface RegistrationCollection {
  id: string
  name: string
  createdAt: string
  
  registrationOpen: boolean    // Can users submit new clubs?
  showcaseInCatalog?: boolean  // Should approved clubs be visible?
  // accepting: DEPRECATED     // Removed, use registrationOpen
  renewalFormActive?: boolean  // Can existing clubs renew?
  // display: DEPRECATED       // Removed, use showcaseInCatalog
}
```

**Requires changes in**:
- `app/api/registration-collections/route.ts` (PATCH handler, migration logic)
- `components/AdminPanel.tsx` (all toggle functions)
- `components/RegistrationsList.tsx` (all display logic)
- `lib/clubs.ts` (migration checks)

---

## OBSERVABILITY ISSUE: removePaths() Hides Partial Failures

### Current Code
**File**: `lib/supabase.ts`  
**Lines**: 140-155

```typescript
export async function removePaths(paths: string[]) {
  const client = getStorageClient()
  if (!client || paths.length === 0) return { removed: 0 }
  try {
    const { data, error } = await client.storage.from('club-data').remove(paths)
    if (error) {
      console.warn('Error removing from Supabase:', error)
      return { removed: 0 }  // 🚨 Hides partial success!
    }
    return { removed: data?.length || 0 }
  } catch (e) {
    console.warn('Error removing from Supabase:', e)
    return { removed: 0 }
  }
}
```

### Fix: Return Detailed Results
**File**: Same  
**Action**: Rewrite to return tuple of (removed, failed, error)

```typescript
export async function removePaths(paths: string[]) {
  const client = getStorageClient()
  if (!client || paths.length === 0) {
    return { removed: 0, total: 0, failed: 0, error: null }
  }
  
  try {
    const { data, error } = await client.storage.from('club-data').remove(paths)
    if (error) {
      console.error('[removePaths] Supabase error:', error.message)
      return { removed: 0, total: paths.length, failed: paths.length, error: error.message }
    }
    
    const removed = data?.length || 0
    const failed = paths.length - removed
    
    if (failed > 0) {
      console.warn(`[removePaths] Partial failure: ${removed}/${paths.length} deleted`)
    }
    
    return { removed, total: paths.length, failed, error: failed > 0 ? 'Partial deletion' : null }
  } catch (e) {
    console.error('[removePaths] Exception:', e)
    return { removed: 0, total: paths.length, failed: paths.length, error: String(e) }
  }
}
```

---

## USABILITY ISSUE: RegistrationsList Doesn't Sync Pending Changes

### Current Code
**File**: `components/RegistrationsList.tsx`  
**Lines**: 70-150

```typescript
// PROBLEM: No loading of pending changes
const [localPendingRegistrationChanges, setLocalPendingRegistrationChanges] = 
  useState<Record<string, { status?: string; denialReason?: string; deleted?: boolean }>>({})

const [registrationStorageLoaded, setRegistrationStorageLoaded] = useState(false)

const REGISTRATIONS_PENDING_KEY = 'montyclub:pendingRegistrationChanges'

// MISSING: useEffect to load from localStorage!
useEffect(() => {
  if (adminApiKey && collectionSlug) {
    loadRegistrations()
  }
}, [adminApiKey, collectionSlug, pendingCollectionsBySlug])
```

### Fix: Add useEffect to Load Pending

**File**: Same  
**After Line 150, add**:

```typescript
useEffect(() => {
  const loadPendingChanges = () => {
    try {
      const pending = localStorage.getItem(REGISTRATIONS_PENDING_KEY)
      if (pending) {
        setLocalPendingRegistrationChanges(JSON.parse(pending))
      }
    } catch (e) {
      console.error('Failed to load pending registration changes:', e)
    }
  }
  
  loadPendingChanges()
  
  // Listen for storage changes from other tabs
  const handleStorageChange = (e: StorageEvent) => {
    if (e.key === REGISTRATIONS_PENDING_KEY) {
      loadPendingChanges()
    }
  }
  
  window.addEventListener('storage', handleStorageChange)
  return () => window.removeEventListener('storage', handleStorageChange)
}, [])
```

---

## SUMMARY: Code Locations by Priority

```
PRIORITY 1 (Before Production):

Issue #1: app/api/registration-collections/route.ts:430-445
  Time: 30 min
  Severity: 🔴 CRITICAL
  
Issue #2: Create lib/registration-lock.ts + update 4 routes
  Time: 1 hour
  Severity: 🔴 CRITICAL
  
Issue #3: app/api/registration-approve/route.ts:45-50 (delete)
  Time: 15 min
  Severity: 🔴 CRITICAL


PRIORITY 2 (Soon After):

Issue #6: components/AdminPanel.tsx:918, 169, 2464
  Time: 2 hours
  Severity: 🔴 CRITICAL (security)
  
Issue #4: app/api/registration-collections/route.ts:273-283
  Time: 45 min
  Severity: 🟠 HIGH


PRIORITY 3 (Next Sprint):

Issue #5: components/AdminPanel.tsx:410-450
  Time: 30 min
  Severity: 🟠 MEDIUM
  
Issue #8: types/club.ts + 4 other files
  Time: 3 hours
  Severity: 🟠 MEDIUM
  
Issue #9: components/RegistrationsList.tsx:150+
  Time: 30 min
  Severity: 🟠 MEDIUM
  
Issue #11: lib/supabase.ts:140-155
  Time: 15 min
  Severity: 🟠 MEDIUM
```

