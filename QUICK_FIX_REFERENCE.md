# Quick Reference: Critical Fixes

## 🔴 Highest Impact Fixes (Use These Immediately)

### 1. **localStorage Atomic Operations**
**File**: `lib/storage-utils.ts`  
**Problem**: Data loss when multiple tabs edit pending changes simultaneously  
**Solution**: Use `updateStorageObject()` for all localStorage modifications

```typescript
// ❌ WRONG - Non-atomic, loses data
const pending = JSON.parse(localStorage.getItem('pending') || '{}')
pending[id] = newValue
localStorage.setItem('pending', JSON.stringify(pending))

// ✅ CORRECT - Atomic, safe
import { updateStorageObject } from '@/lib/storage-utils'
await updateStorageObject('pending', { [id]: newValue }, {})
```

---

### 2. **Request Deduplication for API Calls**
**File**: `lib/request-deduplication.ts`  
**Problem**: Multiple rapid clicks send duplicate API requests  
**Solution**: Use `deduplicateById()` wrapper

```typescript
// ✅ Wrap API calls that should be deduplicated
const debouncedToggle = deduplicateById(
  async (collectionId: string) => {
    const response = await fetch(`/api/registration-collections`, {
      method: 'PATCH',
      body: JSON.stringify({ id: collectionId, enabled: true })
    })
    return response.json()
  },
  (collectionId) => `toggle-${collectionId}` // Unique ID per collection
)

// Multiple rapid calls will only result in 1 actual API request
await debouncedToggle('col-123')
await debouncedToggle('col-123')  // Same as above, cached promise
```

---

### 3. **Slug Collision Detection (PATCH)**
**File**: `app/api/registration-collections/route.ts` (lines ~275)  
**Problem**: Renaming collections didn't check for slug conflicts  
**Fix Applied**: ✅ Already fixed in code

```typescript
// Now includes slug collision check
const newSlug = slugifyName(name.trim())
const existingWithSameSlug = collections.find(
  (c, idx) => idx !== collectionIndex && slugifyName(c.name) === newSlug
)
if (existingWithSameSlug) {
  return NextResponse.json({ error: 'Slug collision...' }, { status: 400 })
}
```

---

### 4. **Broadcast Message Queueing**
**File**: `lib/broadcast.ts`  
**Problem**: Messages lost if receiving tab isn't ready  
**Solution**: ✅ Already fixed - messages auto-queue on failure

```typescript
// Just use broadcast() normally - it handles queueing internally
broadcast('collections', 'update', { id, enabled: true })
// If tab isn't listening yet, message queues and retries automatically

// Monitor queue health
console.log(getBroadcastQueueStats())
// { queuedMessages: 0, maxQueueSize: 100, seenMessagesInMemory: 2 }
```

---

### 5. **File Upload Safety**
**File**: `lib/file-upload-utils.ts`  
**Problem**: Large Excel files crash server with OOM  
**Solution**: Validate size BEFORE processing

```typescript
import { safeReadRequestBody, validateExcelUpload } from '@/lib/file-upload-utils'

// In API route:
const body = await safeReadRequestBody(request, 50 * 1024 * 1024)
if (!body.success) {
  return NextResponse.json({ error: body.error }, { status: 413 })
}

const validation = validateExcelUpload(body.buffer)
if (!validation.valid) {
  return NextResponse.json({ error: validation.error }, { status: 413 })
}

// Now safe to parse workbook
```

---

### 6. **Orphaned Files Auto-Cleanup**
**File**: `app/api/registration-collections/route.ts` (DELETE handler)  
**Problem**: Deleted collections left behind orphaned registration files  
**Fix Applied**: ✅ Already fixed - auto-deletes on collection deletion

---

### 7. **Password Reset Recovery**
**File**: `lib/auth.ts`  
**Problem**: No way to recover lost admin password  
**Solution**: Use token-based recovery

```typescript
import { 
  createPasswordResetToken, 
  verifyResetToken, 
  markResetTokenAsUsed 
} from '@/lib/auth'

// 1. User requests password reset
const token = createPasswordResetToken('admin-username', 15) // 15 min expiry
// Share token with user (email, SMS, etc.)

// 2. User submits reset form with token + new password
const username = verifyResetToken(token)
if (!username) {
  return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 })
}

// 3. Update password and mark token as used
const newHash = hashPassword(newPassword)
markResetTokenAsUsed(token)
// Save newHash to database
```

---

## 🟡 Medium Priority Fixes

### 8. **Request Debouncing (Search, Forms)**
**File**: `lib/request-deduplication.ts`  
**Problem**: Every keystroke triggers an API call  
**Solution**: Use debounce for form inputs

```typescript
import { debounce } from '@/lib/request-deduplication'

const handleSearchChange = debounce(async (query: string) => {
  const response = await fetch(`/api/search?q=${query}`)
  setResults(await response.json())
}, 500) // Wait 500ms after last keystroke

// In component
<input onChange={(e) => handleSearchChange(e.target.value)} />
```

---

### 9. **Idempotency Keys (Multi-Region Deployments)**
**File**: `lib/idempotency.ts`  
**Problem**: Retried requests in distributed systems cause duplicates  
**Solution**: Add Idempotency-Key header to requests

```typescript
const idempotencyKey = crypto.randomUUID()

const response = await fetch('/api/endpoint', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Idempotency-Key': idempotencyKey,  // ← Add this
  },
  body: JSON.stringify(data)
})

// If request times out and retries, same key ensures single execution
```

---

## 📊 Impact Summary

| Fix | Prevents | Impact |
|-----|----------|--------|
| Atomic localStorage | Data loss in race conditions | 🔴 Critical |
| Request dedup | Duplicate operations | 🔴 Critical |
| Slug collision | Routing conflicts | 🔴 Critical |
| Broadcast queue | Lost cross-tab messages | 🟡 High |
| File size check | Server crashes | 🟡 High |
| Orphaned files | Storage cost explosion | 🔴 Critical |
| Password reset | Admin lockout | 🟡 High |

---

## ⚡ Implementation Checklist

- [ ] Update AdminPanel to use `updateStorageObject()` for all pending state
- [ ] Wrap collection toggle with `deduplicateById()`
- [ ] Wrap search API calls with `debounce()`
- [ ] Add file size validation to upload routes
- [ ] Test localStorage race condition with 2 tabs
- [ ] Test broadcast message queueing
- [ ] Test password reset token flow
- [ ] Add Idempotency-Key headers to critical operations
- [ ] Run `npx tsc --noEmit --skipLibCheck` (should pass)
- [ ] Git commit changes

---

## 🐛 How to Debug Issues

### "Syncing..." badge won't disappear
1. Check if `updateStorageObject()` is being used in AdminPanel
2. Verify auto-clear effect is comparing correct keys
3. Use `localStorage.getItem('montyclub:pendingCollectionChanges')` to inspect

### Messages not syncing across tabs
1. Check `getBroadcastQueueStats()` in browser console
2. Verify listener is created on component mount
3. Check browser console for queue retry logs

### Collections not saving
1. Check `PRODUCTION_FIXES.md` section on persistence failure
2. Look for explicit error logs: `[saveCollections] Write failed`
3. Verify Supabase Storage bucket is accessible

### File upload crashes server
1. Check file size before upload with `validateExcelUpload()`
2. Monitor memory with `getMemoryStats()`
3. Check server logs for OOM errors

---

## 📚 Full Documentation

See [PRODUCTION_FIXES.md](./PRODUCTION_FIXES.md) for complete details on all 9 fixes.
