# Quick Test Guide - All Fixes

## Test 1: Collection Deletion Orphaning (Fix #1) ✅

**Purpose**: Verify collection deletion validates file cleanup

**Steps**:
1. Create a collection with name "Test Collection"
2. Add 2-3 registrations to it
3. Delete the collection
4. Verify:
   - Success message appears
   - Collection disappears from list
   - No orphaned files in Supabase Storage

**Expected Result**: ✅ Collection deleted only after all registration files deleted

---

## Test 2: Concurrent Registration Updates (Fix #2) ✅

**Purpose**: Verify registration locking prevents race conditions

**Prerequisites**: Use browser dev tools to throttle network to "Slow 3G" for visible delays

**Steps**:
1. Open admin panel in 2 tabs, same collection
2. Click approve on registration A in Tab 1 (don't wait)
3. Immediately click deny on same registration A in Tab 2 (within 100ms)
4. Check database state
5. Verify:
   - Only ONE state change took effect
   - Second operation either queued or rejected
   - No corrupted state

**Expected Result**: ✅ No race condition, lock ensures sequential execution

---

## Test 3: API Key Security (Fix #4) ✅

**Purpose**: Verify API key not persisted to localStorage

**Steps**:
1. Open admin panel
2. Enter API key and save
3. Open DevTools → Application → localStorage
4. Search for "adminKey" or "analytics:adminKey"
5. Reload page
6. Verify API key prompt appears again

**Expected Result**: ✅ No "analytics:adminKey" found in localStorage

---

## Test 4: Display Toggle Race (Fix #5) ✅

**Purpose**: Verify only one collection can be displayed

**Steps**:
1. Create 3 collections: A, B, C
2. Rapidly toggle display: A → B → C → A
3. Open DevTools → Network tab
4. Verify:
   - Final state matches last toggle
   - No collection has display=false then true again
   - Database consistency maintained

**Expected Result**: ✅ Only A has display=true after final toggle

---

## Test 5: Slug Collision Detection (Fix #6) ✅

**Purpose**: Verify slug collisions are detected

**Steps**:
1. Create collection "Test Club"
2. Create another collection "Test Club" (exact duplicate)
3. Verify error appears: "Collection with this name already exists"
4. Try "test club" (different case)
5. Verify error appears: "would create duplicate URL"

**Expected Result**: ✅ Both attempts rejected with appropriate error

---

## Test 6: Pending Changes Sync (Fix #7) ✅

**Purpose**: Verify RegistrationsList loads pending changes

**Steps**:
1. Open admin panel
2. Open DevTools → Application → localStorage
3. Check "montyclub:pendingRegistrationChanges"
4. Manually set: `{"reg123": {"status": "approved"}}`
5. Reload page
6. Verify registration shows as approved in UI

**Expected Result**: ✅ Pending change reflected in UI after reload

---

## Test 7: Input Type Security (Fix #9) ✅

**Purpose**: Verify API key input is masked

**Steps**:
1. Open admin analytics section
2. Click in API key field
3. Type some characters
4. Verify:
   - Characters appear as dots (●●●)
   - Not readable on screen
   - Password manager offers to save

**Expected Result**: ✅ Input masked as password field

---

## Test 8: File Cleanup on Collection Delete (Fix #1) ✅

**Purpose**: Verify no orphaned files remain

**Prerequisites**: Use Supabase dashboard to monitor storage

**Steps**:
1. Note storage usage in Supabase dashboard
2. Create collection with 5 registrations
3. Verify files created in `registrations/{collectionId}/` folder
4. Delete collection
5. Verify all registration files deleted

**Expected Result**: ✅ No orphaned files, storage cleaned up

---

## Test 9: Registration Lock Ordering (Fix #2) ✅

**Purpose**: Verify locks queue operations correctly

**Prerequisites**: Console has structured logging enabled

**Steps**:
1. Open DevTools → Console
2. Quickly click: Approve → Update → Deny on same registration
3. Watch console logs
4. Verify messages show:
   - FIFO ordering
   - Each operation completes before next starts
   - No overlapping reads/writes

**Expected Result**: ✅ Operations execute in order without overlap

---

## Regression Tests

### Test R1: Basic Admin Operations
- ✅ Login with username/password
- ✅ Create collection
- ✅ View registrations
- ✅ Approve/deny registration
- ✅ Update registration details
- ✅ Delete registration
- ✅ Logout

### Test R2: User Registration Flow
- ✅ Access registration form by collection
- ✅ Fill out all required fields
- ✅ Submit registration
- ✅ Receive confirmation message
- ✅ Registration appears in admin view

### Test R3: Cross-Tab Sync
- ✅ Open admin in 2 tabs
- ✅ Create collection in Tab 1
- ✅ Verify appears in Tab 2
- ✅ Toggle collection in Tab 1
- ✅ Verify toggle reflected in Tab 2

### Test R4: Dark Mode
- ✅ Toggle theme in multiple pages
- ✅ Verify styles consistent
- ✅ Verify no text disappears

### Test R5: Responsive Design
- ✅ Test on mobile (375px width)
- ✅ Test on tablet (768px width)
- ✅ Test on desktop (1920px width)
- ✅ Verify no layout breaks

---

## Performance Baseline

After fixes, measure and record:

| Metric | Target | Acceptable |
|--------|--------|-----------|
| Page Load | <2s | <3s |
| Admin Login | <1s | <2s |
| Create Collection | <1s | <2s |
| Approve Registration | <1s | <2s |
| List Collections | <500ms | <1s |
| API Key Save | <500ms | <1s |

---

## Success Criteria

✅ All 9 tests pass  
✅ All regression tests pass  
✅ No new errors in console  
✅ No performance degradation  
✅ API key not in localStorage  
✅ Locks prevent concurrency issues  

**If any test fails**: 
1. Check browser console for errors
2. Verify network requests in DevTools
3. Check server logs for API errors
4. Review Supabase Storage for orphaned files
5. Post issue details to development team

---

**Test Date**: ___________  
**Tester**: ___________  
**Result**: ✅ PASS / ❌ FAIL  
**Notes**: _________________________________________________
