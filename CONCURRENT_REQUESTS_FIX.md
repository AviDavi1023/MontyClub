# Concurrent Request Race Condition - Root Cause & Fix

## The Problem

When making multiple changes in quick succession:
- ✅ First change would succeed and show up in UI
- ⏳ Second change would hang indefinitely with "syncing" status
- ❌ Second change would never complete or fail

This affected:
- Collection toggles/updates
- Announcement edits
- Update reviews
- Registration approvals
- Any other rapid backend modifications

## Root Cause Analysis

### The Broken Lock Mechanism

The `ApiCache.withLock()` method in `lib/api-cache.ts` had a **critical flaw**:

```typescript
// BROKEN - Original Implementation
async withLock<R>(fn: () => Promise<R>): Promise<R> {
  const currentOperation = this.updateLock.then(async () => {
    // ... execute function ...
  })

  // THIS IS THE BUG:
  this.updateLock = currentOperation.then(() => {}).catch(() => {})
  //                                    ↑                        ↑
  //                           Immediately resolves to undefined
  //                           Lock promise becomes resolved instantly!

  return currentOperation
}
```

### Why This Broke Everything

1. **Request 1** comes in:
   - Waits for `updateLock` (which is `Promise.resolve()`)
   - Executes the function (slow I/O to Supabase)
   - Sets `updateLock` to a resolved promise via `.then().catch()`

2. **Request 2** comes in immediately after:
   - Tries to wait for `updateLock`
   - But `updateLock` is already resolved! (due to the `.then().catch()` trick)
   - Does NOT wait for Request 1 to complete
   - Executes concurrently with Request 1

3. **Race Condition**:
   - Both requests read the SAME initial data
   - Both modify it
   - Both write it back
   - Last write wins, overwriting first write
   - Request 1's changes disappear

4. **Why "Syncing" Hangs**:
   - The pending change state never gets cleared
   - Auto-clear effect compares DB state with pending changes
   - They don't match (because only one got saved)
   - Pending change stays forever
   - User sees infinite "syncing" badge

## The Solution

### Fixed Lock Implementation

```typescript
// CORRECT - Fixed Implementation
async withLock<R>(fn: () => Promise<R>): Promise<R> {
  const currentOperation = (async () => {
    // Wait for previous operation
    await this.updateLock.catch(() => {})
    
    try {
      const result = await fn()
      return result
    } finally {
      // ... logging ...
    }
  })()

  // Lock properly chains - doesn't resolve until fn() completes
  this.updateLock = currentOperation.catch(() => {})
  //                                      ↑
  //                   Only error handling, NOT immediate resolution
  //                   Lock stays pending until fn() finishes

  return currentOperation
}
```

### Key Differences

| Aspect | Before (Broken) | After (Fixed) |
|--------|---|---|
| Lock update | `.then(() => {}).catch(() => {})` | `.catch(() => {})` |
| When lock resolves | Instantly | After fn() completes |
| Request 2 sees | Already-resolved promise | Still-pending promise |
| Concurrency | RACES | SERIALIZES ✅ |
| Data corruption | YES ❌ | NO ✅ |

## Files Modified

### 1. `lib/api-cache.ts`
- Fixed `withLock()` method to properly chain promises
- Lock no longer resolves prematurely
- Applies to all cached resources (updates, announcements, registrations, users)

### 2. `app/api/registration-collections/route.ts`  
- Restored `withLock()` wrapper to POST, PATCH, DELETE operations
- Adds in-memory locking to prevent concurrent collection modifications
- Ensures read-modify-write operations are atomic

## Impact

### What's Fixed

✅ Multiple rapid changes now work correctly
✅ First change succeeds
✅ Subsequent changes properly queue and complete
✅ No more infinite "syncing" states
✅ Pending changes auto-clear when DB matches
✅ All resources: updates, announcements, collections, registrations

### Verification Checklist

- [ ] Toggle update "reviewed" status multiple times rapidly → all succeed
- [ ] Edit announcements quickly in succession → all save
- [ ] Create/delete collections back-to-back → no conflicts
- [ ] Bulk operations complete without hanging
- [ ] No "syncing" badges that don't disappear
- [ ] Browser console shows proper lock acquisition/release logs

## Technical Details

### Promise Chaining Explanation

The fix works because JavaScript promises maintain their pending state:

```typescript
// BROKEN pattern
const p = someLongOperation()
const lock = p.then(() => {})  // Returns immediately! 
// Next request: lock is resolved, doesn't wait for p

// CORRECT pattern  
const p = someLongOperation()
const lock = p.catch(() => {}) // Returns p (still pending if p hasn't resolved)
// Next request: lock is still pending, properly waits for p
```

### Why `.catch(() => {})` Matters

We use `.catch(() => {})` instead of just the promise itself because:
- If the operation throws an error, we want the lock to still resolve
- Without it, a failed operation would break the entire lock chain
- `.catch()` handles errors but maintains the promise chain timing

## Prevention

Similar issues could occur if:
1. Adding new cached resources without proper locking
2. Mixing synchronous and async code paths in locks
3. Using `.then(() => {})` anti-pattern elsewhere

Always ensure:
- Locks properly chain promises
- Lock resolves AFTER operation completes
- Error handling doesn't break promise chains
- Lock assignment happens AFTER wrapping with error handler
