# Debugging Guide: Sync Issues & Queue Lock

## How to Identify Stuck Operations

### Check Queue Stats
```typescript
// In Node.js server logs
const collectionsLock = getQueueLock('registration-collections')
console.log(collectionsLock.getStats())
// Output: { pending: 5, processing: true }
// If pending > 0 for more than 30 seconds, something is stuck
```

### Monitor Console Logs
Look for these JSON log patterns:

```json
// Operation queued
{"tag": "collections-lock", "step": "wait", "operationId": "col-1234567890-abc123"}

// Operation processing
{"tag": "collections-lock", "step": "acquired", "operationId": "col-1234567890-abc123"}

// Operation timeout (indicates problem)
{"tag": "collections-api", "step": "error", "operationId": "PATCH-...", "error": "Operation ... exceeded timeout"}

// Consistency verification
{"tag": "collections-consistency", "step": "verified", "collectionId": "col-...", "attempt": 2}
{"tag": "collections-consistency", "step": "verification-timeout", "collectionId": "col-...", "maxRetries": 5}
```

---

## Common Scenarios

### Scenario 1: User Makes 3 Rapid Toggles

**Expected Flow:**
```
T0ms:    Toggle #1: enabled=false→true (optimistic update)
         PATCH #1 queued in lock

T50ms:   Toggle #2: display=false→true (optimistic update)
         PATCH #2 queued in lock (waiting for #1)

T100ms:  Toggle #3: accepting=false→true (optimistic update)
         PATCH #3 queued in lock (waiting for #1, #2)

T300ms:  Lock releases PATCH #1
         Reads collections, makes change, writes, verifies consistency ✓
         
T600ms:  Lock releases PATCH #2
         Reads collections (now has #1's change), makes change, writes, verifies ✓
         
T900ms:  Lock releases PATCH #3
         Reads collections (now has #1+#2's changes), makes change, writes, verifies ✓

T1200ms: All three changes visible in database
         Auto-clear effect clears pending state
         UI shows final state
```

**What Could Go Wrong (Fixed):**
- ❌ Promise chain lock hangs on #1 error → #2, #3 never run
- ❌ #2 reads stale data (Supabase hasn't propagated #1 yet)
- ❌ Auto-clear clears pending too early on stale reads

**Verification in Console:**
```javascript
// After toggles complete, run:
window.syncDiagnostics()

// Should show:
{
  "collections": {
    "pending": {}  // Should be empty after 2+ seconds
  }
}
```

---

### Scenario 2: Toggle Then Immediately Reload

**Expected Flow:**
```
T0ms:    User clicks toggle enabled
         Optimistic update to localStorage
         PATCH sent to /api/registration-collections

T500ms:  API returns success
         Code schedules loadCollections() for 300ms later
         
T600ms:  loadCollections() executes
         GET /api/registration-collections
         Might still get stale data from Supabase

T610ms:  Collections state updates in React
         Auto-clear effect detects mismatch
         Keeps pending state (correct!)

T1500ms: Real data finally visible in Supabase
         Next GET will return correct state
         Auto-clear effect clears pending ✓

T1600ms: User sees final state
```

**What Could Go Wrong (Fixed):**
- ❌ Immediate refresh could see stale data
- ❌ Auto-clear could clear pending prematurely
- ❌ User thinks change succeeded but it reverts

---

### Scenario 3: Two Admins Toggle Same Collection Simultaneously

**Expected Flow:**
```
Admin A clicks toggle enabled=true
Admin B clicks toggle display=true

Both PATCH requests hit different workers (Vercel's horizontal scaling)
But they both go into the SAME QueueLock (per domain)

T0ms:   Admin A's PATCH queued
T10ms:  Admin B's PATCH queued (waiting for A)

T200ms: Admin A's PATCH processes
        Reads: enabled=false, display=false
        Writes: enabled=true, display=false
        Verifies consistency ✓

T500ms: Admin B's PATCH processes
        Reads: enabled=true, display=false (has A's change)
        Writes: enabled=true, display=true
        Verifies consistency ✓

Result: Both changes applied in order ✓
```

**What Could Go Wrong (Fixed):**
- ❌ Without QueueLock, each worker has independent promise chain
- ❌ Both could read/write concurrently
- ❌ Last write wins, first admin's change lost

---

## Debugging Strategies

### 1. Monitor Queue Depth
```javascript
// Browser console (checks server queue)
// Note: This is client-side only, doesn't show server queue directly
// But watch API response times to infer queue depth

// Long API times (>500ms) + many pending in localStorage = queue building up
window.syncDiagnostics()
```

### 2. Trace Collection Changes
```javascript
// See all pending changes trying to sync
window.getCollectionsPending()

// Example output:
// {
//   "col-123": { enabled: true, _timestamp: 1234567890 },
//   "col-456": { display: true, _timestamp: 1234567891 }
// }
```

### 3. Watch Network Requests
DevTools → Network tab → Filter "registration-collections"
- Look at request/response times
- If response time > 1 second, Supabase might be slow
- If multiple requests are pending, queue is building

### 4. Check Consistency Verification
```
Search console for: "collections-consistency"

If you see: "verification-timeout"
→ The write didn't propagate within 5 retries
→ Might indicate Supabase issues
→ But change is still in database, just slow
```

---

## Performance Tuning

### If Toggles Feel Slow (>1 second)

**Current Delays:**
```
T0ms:    Click
T50ms:   Optimistic update
T200ms:  API response (PATCH completes)
T300ms:  Refresh delayed
T400ms:  Collections state updated
T1000ms: Auto-clear debounce fires
T1100ms: Pending cleared, UI updates
Total: ~1.1 seconds perceived delay
```

**Optimization Options:**

1. **Reduce auto-clear debounce** (trades safety for speed)
   ```typescript
   // Current: 1000ms debounce
   // Option: 500ms debounce (less safe, faster)
   setTimeout(() => { /* auto-clear */ }, 500)
   ```

2. **Reduce consistency verification retries** (trades reliability for speed)
   ```typescript
   // Current: 5 retries × ~200ms = 1 second
   // Option: 3 retries × ~200ms = 600ms
   const consistencyOk = await verifyConsistency(id, changes, 3)
   ```

3. **Skip consistency verification for simple changes** (faster but riskier)
   ```typescript
   // Only verify if display is changing (complex snapshot logic)
   if (display !== undefined) {
     await verifyConsistency(...)
   }
   // Skip for simple enabled/accepting changes
   ```

### If Multiple Changes Are Queuing

**Signs:**
- Console shows `pending: 5` in getStats()
- API responses > 500ms each

**Causes:**
- Slow Supabase (check status page)
- Slow network (check DevTools throttling)
- Heavy Supabase operations (list registrations, etc.)

**Solutions:**
1. Increase timeout: `getQueueLock('registration-collections', 60000)` (60s)
2. Check Supabase logs for slow queries
3. Optimize listPaths() or readJSONFromStorage() calls
4. Consider caching more aggressively

---

## Emergency Recovery

### If Queue Locks Get Stuck

```typescript
// In browser console on admin page
const lock = getQueueLock('registration-collections')
lock.clear()
console.log('Queue cleared')
```

This will:
1. Reject all pending operations
2. Clear the queue
3. Allow fresh requests to proceed

**Side Effects:**
- Any in-flight requests will fail
- Pending changes in localStorage might not sync
- User should refresh page or retry manually

### If Auto-Clear Gets Stuck

```javascript
// Clear pending changes from localStorage
localStorage.removeItem('montyclub:pendingCollectionChanges')
localStorage.removeItem('montyclub:pendingCollectionChanges:backup')

// Reload admin panel
location.reload()
```

---

## Monitoring Checklist

```
Daily:
☐ Check browser console for timeout errors
☐ Run window.syncDiagnostics() - pending should be empty
☐ Test rapid toggles (5 in succession) - should apply in order
☐ Monitor API response times - should be < 500ms

Weekly:
☐ Check Supabase metrics for slow queries
☐ Review error logs for consistency timeout patterns
☐ Test with simulated network delay (DevTools throttling)
☐ Verify queue lock stats don't accumulate

Monthly:
☐ Load test with multiple concurrent toggles
☐ Verify eventual consistency verification is working
☐ Check for memory leaks in queue lock
☐ Review and tune debounce/timeout values
```

---

## Key Takeaways

1. **QueueLock prevents concurrent modifications** - Sequential processing ensures no lost updates
2. **Consistency verification prevents overwrites** - Polls until writes propagate
3. **Delayed refresh accounts for eventual consistency** - Gives Supabase time to replicate
4. **Auto-clear debounce prevents premature cleanup** - Only clears when stable
5. **Error propagation prevents silent failures** - Snapshot errors return 500 instead of success

All these work together to make the sync experience smooth and reliable, even with rapid changes.
