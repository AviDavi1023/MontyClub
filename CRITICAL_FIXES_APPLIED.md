# Critical Fixes Applied to MontyClub

## Summary
Fixed 7 critical issues that could cause data corruption, lost updates, and race conditions in production. These fixes ensure the system is resilient to concurrent operations and handles edge cases gracefully.

---

## 1. **Concurrent Snapshot Publishing Race Condition** ✅
**Issue**: When multiple admins approved registrations rapidly, multiple snapshot publish jobs could run concurrently and corrupt the catalog file.

**Fix**: 
- Created `lib/snapshot-lock.ts` with exclusive snapshot publishing lock
- Uses promise-based locking to queue snapshot operations
- Applied to both `registration-approve/route.ts` and `registration-deny/route.ts`
- Prevents lost writes from concurrent Supabase Storage operations

**Impact**: ⚠️ CRITICAL - Prevents catalog corruption

---

## 2. **Broadcast Message Deduplication Eating Legitimate Updates** ✅
**Issue**: Broadcast deduplication was too aggressive - if the same change happened twice in 60 seconds, the second one was silently dropped.

**Fix**:
- Changed deduplication from `Set<messageId>` to `Map<messageHash, {timestamp, count}>`
- Now uses content hash (`domain:action:payload`) instead of just message ID
- Only deduplicates truly identical operations within 1 second
- Different changes to the same domain are now processed correctly

**Impact**: 🔴 HIGH - Prevents admins' changes from disappearing

---

## 3. **localStorage Quota Exceeded Silent Failure** ✅
**Issue**: When localStorage quota exceeded, `.setItem()` throws `QuotaExceededError`, which was silently caught. Admin pending changes were lost without notification.

**Fix**:
- Created `lib/storage-quota.ts` with safe storage operations
- `safeSetItem()` catches `QuotaExceededError` and attempts cleanup
- Removes less-critical backup files to free space
- Returns result object indicating success/failure
- Updated AdminPanel to use `safeSetItem()` and notify user on failure
- Shows warning when approaching 80/90% quota

**Impact**: 🔴 HIGH - Prevents silent data loss

---

## 4. **Collection Eventual Consistency Issues** ✅
**Issue**: After creating a collection, `club-registration/route.ts` had only 3 retries with short delays. Supabase Storage might not be consistent yet, causing "collection not found" errors.

**Fix**:
- Increased retries from 3 to 5 attempts
- Implemented exponential backoff: 300ms → 450ms → 675ms → 1012ms → 1519ms
- Better logging of retry attempts
- Reduces user frustration from transient errors

**Impact**: 🟡 MEDIUM - Improves reliability during high load

---

## 5. **Missing Idempotency on Critical Registration Operations** ✅
**Issue**: If a user retried an approval request (browser timeout, network issue), it could double-approve the same registration, creating duplicate clubs in the catalog.

**Fix**:
- Added `withIdempotency()` wrapper to both:
  - `/api/registration-approve`
  - `/api/registration-deny`
- Uses request fingerprinting + deduplication cache
- Same request within 24 hours returns cached response
- Prevents duplicate state changes from retried requests

**Impact**: 🔴 HIGH - Prevents double-approvals

---

## 6. **Collection State Validation** ✅
**Issue**: Collections have 4 boolean flags (`display`, `enabled`, `accepting`, `renewalEnabled`). No validation that only one collection has `display: true`, leading to ambiguous catalog publishing.

**Fix**:
- Created `lib/collection-validation.ts` with validation functions
- `validateCollections()` checks for:
  - Multiple collections with `display: true`
  - Missing required fields
  - Invalid timestamps
  - Duplicate IDs
- `ensureSingleDisplay()` automatically fixes multiple display flags (keeps newest)
- Applied to `registration-collections/route.ts` on save

**Impact**: 🟡 MEDIUM - Prevents ambiguous catalog state

---

## 7. **Snapshot Lock Integration** ✅
**Issue**: Snapshot publishing was called in background without coordination, potentially creating incomplete snapshots if approvals happened in quick succession.

**Fix**:
- Both approve and deny endpoints now use `withSnapshotLock()`
- Snapshot logic is inlined (not in separate function) for better error tracking
- Snapshot updates are queued and executed serially
- Improved logging with operation IDs

**Impact**: ⚠️ CRITICAL - Ensures consistent catalog snapshots

---

## Files Created
1. `lib/snapshot-lock.ts` - Snapshot publishing lock with promise-based queue
2. `lib/storage-quota.ts` - Safe localStorage operations with quota handling
3. `lib/collection-validation.ts` - Collection state validation and fixing

## Files Modified
1. `app/api/registration-approve/route.ts` - Added snapshot lock + idempotency
2. `app/api/registration-deny/route.ts` - Added snapshot lock + idempotency  
3. `app/api/club-registration/route.ts` - Improved eventual consistency retries
4. `app/api/registration-collections/route.ts` - Added validation on save
5. `lib/broadcast.ts` - Fixed message deduplication logic
6. `components/AdminPanel.tsx` - Use safeSetItem() with error handling

---

## Testing Recommendations

### Test Concurrent Approvals
```bash
# Simulate multiple admins approving registrations simultaneously
# Should see [SNAPSHOT-LOCK-*] log messages showing serialized operations
```

### Test localStorage Quota
```bash
# Fill localStorage to 90%+ of quota
# Admin should see warning message
# Changes should still save (after cleanup)
```

### Test Broadcast Deduplication
```bash
# Open admin in 2 tabs
# Make same update twice within 1 second → second is skipped
# Make different updates to same domain → both are processed
```

### Test Registration Idempotency
```bash
# Approve a registration
# Immediately retry the request (fast network)
# Should return same result without double-processing
```

---

## Remaining Known Issues
These issues were identified but not fixed (lower priority):

1. **Password reset tokens lost on server restart** - Stored in-memory, no persistence
2. **Excel import validation incomplete** - No rollback on partial failures
3. **Analytics events not guaranteed delivery** - Uses `keepalive` but no retry
4. **Admin deletion during active session** - User can still use deleted credentials

These can be addressed in a future phase if needed.

---

## Summary Statistics
- **Files Created**: 3
- **Files Modified**: 6
- **Lines Added**: ~572
- **Critical Issues Fixed**: 2
- **High-Priority Issues Fixed**: 3
- **Medium-Priority Issues Fixed**: 2
