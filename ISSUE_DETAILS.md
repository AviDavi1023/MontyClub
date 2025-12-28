# Critical Issues - Quick Reference & Execution Flows

## SCENARIO SIMULATIONS

### Scenario A: Admin Deletes Collection During Supabase Outage
```
Timeline:
T0:  Admin clicks "Delete Collection-A" (contains 50 registrations)
T1:  DELETE /api/registration-collections
     → listPaths("registrations/col-abc") times out
     → catch block logs error but continues ❌
T2:  removePaths([...]) never called
T3:  collections.splice() removes Collection-A from array
T4:  saveCollections() succeeds
T5:  Admin sees "Collection deleted successfully" ✓
T6:  ~2 minutes later, Supabase recovers
T7:  50 files in registrations/col-abc/ are now orphaned
T8:  New attempt to cleanup: listPaths() shows files, but collection is gone
T9:  No way to clean up — admin can't delete non-existent collection

COST IMPACT: $0.18/month × 50 files × 12 months = $2.16/year minimum
IF THIS HAPPENS WEEKLY: $112/year from orphaned files
```

### Scenario B: Approval Race Condition
```
Timeline:
T0:  Admin approves Reg-123 on Instance-A (has cache)
T1:  POST /registration-approve → readJSONFromStorage(reg-123)
T2:  registration.status = 'approved'
T3:  writeJSONToStorage() succeeds
T4:  registrationActionsCache.set(cache[path] = approved) on Instance-A
T5:  RegistrationsList.tsx refreshes page
T6:  Instance-B serves request (no cache)
T7:  fetch(/api/club-registration?collection=...) reads Supabase directly
T8:  Supabase might still show pending (eventual consistency)
T9:  OR fetch(/api/registration-approve-check) would read cache but cache is on Instance-A
T10: Admin sees "pending" and clicks approve again
T11: T11 reads Supabase (still shows pending due to propagation lag)
T12: T11 writes approved again (idempotent, but confusing)
T13: approvedAt timestamp is overwritten
T14: Could lose original approval timestamp

ISSUE: No cross-instance cache invalidation
```

### Scenario C: Multi-Tab Collection Display Toggle Race
```
Timeline - Two Admin Tabs:

TAB-A                                TAB-B
[Read collections from server]
  Collections: [A.display=F]

                                     [Read collections from server]
                                       Collections: [A.display=F]

[Admin checks Display checkbox for A]
[Local read: A.display=F]
[Set to true]
[Lock acquired on server]
[Read collections: A.display=F]
[Set all display=F except A]
[Write: A.display=T, B.display=F]
[Write succeeds]
[Lock released]

                                     [Admin checks Display checkbox for B]
                                     [Local read still stale: A.display=F]
                                     [Set to true]
                                     [Lock acquired on server]
                                     [Read collections: A.display=T] ← now true!
                                     
Wait, this is actually OK because of the PATCH endpoint logic!
Let me trace again:

TAB-A (PATCH with display:true):
  → if (val === true) { for (let i = 0; ...) collections[i].display = (i === collectionIndex) }
  → Sets A.display=true, all others false
  → Writes successfully

TAB-B (PATCH with display:true):
  → BUT TIMING: Read happens at T2 before TAB-A write
  → Reads stale [A.display=F, B.display=F]
  → Sets A.display=F, B.display=T
  → Writes [A.display=F, B.display=T]
  → Overwrites TAB-A's write!
  → Result: A.display=F (reverted), B.display=T

Root cause: Lock doesn't help when data is read BEFORE lock is acquired
```

### Scenario D: Registration Status Corruption via Concurrent Updates
```
Timeline:

Instance-A: Admin clicks APPROVE
  T0: readJSONFromStorage(reg-123)
      → {status: pending, clubName: "Chess", notes: "old notes"}
      
Instance-B: (simultaneously) Admin edits Notes
  T1: readJSONFromStorage(reg-123)
      → {status: pending, clubName: "Chess", notes: "old notes"}
      
Instance-A (T2): 
  registration.status = 'approved'
  registration.approvedAt = now()
  → {status: approved, clubName: "Chess", notes: "old notes", approvedAt: now()}
  writeJSONToStorage() succeeds

Instance-B (T3):
  Object.assign(registration, {notes: "new notes"})
  → {status: pending, clubName: "Chess", notes: "new notes"}
  writeJSONToStorage() succeeds
  
RESULT: T3 write OVERWRITES T2 write
  Supabase now shows: {status: pending, notes: "new notes"}
  APPROVAL IS LOST

registrationActionsCache.withLock() only protects approve route, not update route!
```

---

## DATA STRUCTURE STATE INCONSISTENCIES

### Collections State Paths
```
Browser LocalStorage:
  montyclub:pendingCollectionChanges = {
    col-temp-123: { created: true, name: "Fall 2025", enabled: true }
    col-abc-456: { display: false }  ← pending change
  }
  montyclub:collectionsUpdated = { id: col-abc-456, t: 1703804400000 }

Server Memory:
  updateLock = Promise { resolved at T }
  
Server Storage (Supabase):
  settings/registration-collections.json = [
    { id: "col-abc-456", name: "Spring 2025", enabled: true, display: true }
  ]

Reconciliation in AdminPanel.tsx:
  1. Fetch /api/registration-collections → [{ id: "col-abc-456", display: true }]
  2. Load localPendingCollectionChanges → { col-abc-456: { display: false } }
  3. Apply overlay: display = false (pending overrides server)
  4. Show admin: Collection with display=false (even though server says true)
  5. Admin clicks toggle → send PATCH with display=true
  6. Server receives PATCH, overwrites all other displays
  7. But during network delay, localStorage was not cleared!
  8. If browser crashes now, next reload shows display=false again

ISSUE: Multiple sources of truth with no clear reconciliation
```

### Registration Status Paths
```
User submits via /api/club-registration:
  1. Find collection by slug (retry loop if not found yet)
  2. Create registration with status='pending'
  3. Write to registrations/{collectionId}/{regId}.json

Admin approves:
  1. Reads registration
  2. Sets status='approved', approvedAt=now()
  3. Writes back
  4. Updates registrationActionsCache (instance-local)

Admin refreshes RegistrationsList:
  1. GET /api/club-registration?collection=...
  2. listPaths() and read all registrations
  3. Display in UI

ISSUE: 
  - If cache on Instance-A but request goes to Instance-B
  - Instance-B has no knowledge of the approval just made on A
  - Instance-B reads stale Supabase state
```

---

## LOCK EFFECTIVENESS MATRIX

| Operation | Lock Used | Scope | Gap |
|-----------|-----------|-------|-----|
| Create collection | Yes (`withLock()`) | Per instance | Slug collision check only at create, not rename ✓ |
| Update collection | Yes (`withLock()`) | Per instance | Display toggle can race if reads stale data ✗ |
| Delete collection | Yes (`withLock()`) | Per instance | Cleanup failure not detected ✗ |
| Approve registration | Yes (`withLock()`) | Per instance | Cache not invalidated across instances ✗ |
| Deny registration | Yes (`withLock()`) | Per instance | Can race with update ✗ |
| Update registration | **NO** | None | Direct race condition ✗ |
| Delete registration | **NO** | None | Direct race condition ✗ |

---

## THE "DISPLAY vs ACCEPTING vs ENABLED" CONFUSION

### What Admin Sees
```
┌─ Collection: "Spring 2025" ──────────────────┐
│                                              │
│  ☑ Enabled    ☑ Display    ☑ Accepting      │
│  ☐ Renewal    [Edit] [Delete]               │
│                                              │
│  Registrations:                              │
│    • Pending: 5                              │
│    • Approved: 12                            │
│    • Rejected: 2                             │
└──────────────────────────────────────────────┘
```

### What Each Flag Actually Does
```
enabled = accepting:  Can users submit new registrations?
         (currently same flag for back-compat)

display:              Should this collection's clubs appear in public catalog?

renewalEnabled:       Is the renewal form available for this collection?
```

### Confusing Combinations
```
enabled=T, display=T, accepting=T, renewal=F
  → Users can submit new clubs ✓
  → Users can see clubs in catalog ✓
  → Users cannot renew clubs ✗
  
enabled=T, display=F, accepting=T, renewal=F
  → Users can submit new clubs (but where?)
  → Users cannot see clubs in catalog
  → Users cannot renew clubs
  → Q: Why accept submissions if not displayed?

enabled=F, display=T, accepting=F, renewal=F
  → Users cannot submit (but old clubs are visible)
  → Why show old clubs if registrations closed?
```

### Better Naming
```
Current              Better Name             Semantics
─────────────────────────────────────────────────────────
enabled              registrationOpen        Is new registration allowed?
display              showcaseInCatalog       Should approved clubs be visible?
accepting            (same as enabled)       (redundant, can remove)
renewalEnabled       renewalFormActive       Can existing clubs renew?
```

---

## ROOT CAUSES SUMMARY

| Issue | Root Cause |
|-------|-----------|
| Orphaned registrations on delete | No validation of cleanup success before collection deletion |
| Approval cache invalidation | In-memory cache doesn't propagate across instances |
| Concurrent update corruption | Different routes don't share locking (update/deny/approve) |
| Collection slug lookup fragile | Retries based on hardcoded delays, not actual propagation signals |
| Multi-tab display race | Stale read before lock acquired (lock doesn't protect read phase) |
| Admin key plain text | localStorage doesn't encrypt, and key is obvious |
| Slug collision frontend miss | Frontend optimistic update doesn't validate slug |
| Unclear flag semantics | enabled/display/accepting/renewal are poorly named |
| RegistrationsList pending sync miss | No useEffect to load pending changes from localStorage |
| removePaths partial failure silent | Error handling treats partial deletion same as total failure |

