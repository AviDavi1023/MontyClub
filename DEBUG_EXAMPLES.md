# Debug Log Examples - Know What to Expect

## Scenario 1: Everything Working ✅

### What You See in Console (Browser)

After running `window.syncDiagnostics()` **immediately after making 2 changes:**

```javascript
{
  timestamp: "2025-12-12T15:30:45.123Z",
  announcements: {
    pending: {},  // ← EMPTY, changes are being saved instantly
    current: {
      "ann-welcome": "Welcome message",
      "ann-2": "Second announcement just saved"  // ← BOTH HERE!
    }
  },
  updates: {
    pending: {}
  },
  collections: {
    pending: {}
  }
}
```

**After reloading:**

```javascript
{
  timestamp: "2025-12-12T15:31:20.456Z",
  announcements: {
    pending: {},  // ← Still empty (good!)
    current: {
      "ann-welcome": "Welcome message",
      "ann-2": "Second announcement just saved"  // ← Both still here!
    }
  },
  // ... rest same
}
```

**Console logs you'll see:**

```
[CHECKPOINT 1] Saving announcement ann-2
Request ID: ann-ann-2-1702345645012
Text: "Second announcement just saved"
Timestamp: 2025-12-12T15:30:44.901Z

[API CALL] Sending PATCH request for announcement ann-2
URL: /api/announcements/ann-2
Method: PATCH
Body: {"announcement":"Second announcement just saved"}

[API RESPONSE] Response received for announcement ann-2
Status: 200 OK
Time taken: 234ms

[API SUCCESS] Announcement ann-2 response data: {id: "ann-2", announcement: "Second announcement just saved"}

[FETCH] Fetching fresh announcements after save...
[FETCH] Getting fresh announcements from server
[FETCH] Fresh announcements from server: {ann-welcome: "...", ann-2: "Second announcement just saved"}
[FETCH] Keys: ann-welcome, ann-2

[DONE] Saving announcement ann-2 completed
```

---

## Scenario 2: Race Condition - Second Change Lost ❌

### What You See in Console (Browser)

After running `window.syncDiagnostics()` **immediately after making 2 changes:**

```javascript
{
  timestamp: "2025-12-12T15:32:10.789Z",
  announcements: {
    pending: {
      "ann-2": "Second announcement text"  // ← STUCK HERE
    },
    current: {
      "ann-welcome": "Welcome message",
      "ann-2": "Original text"  // ← HASN'T CHANGED! Mismatch!
    }
  },
  updates: {
    pending: {}
  },
  collections: {
    pending: {}
  }
}
```

**After reloading:**

```javascript
{
  timestamp: "2025-12-12T15:32:45.321Z",
  announcements: {
    pending: {
      "ann-2": "Second announcement text"  // ← STILL STUCK (persisted in localStorage)
    },
    current: {
      "ann-welcome": "Welcome message",
      "ann-2": "Original text"  // ← Still not updated from database
    }
  }
}
```

**After waiting 2-3 minutes and reloading:**

```javascript
{
  timestamp: "2025-12-12T15:35:20.654Z",
  announcements: {
    pending: {
      "ann-2": "Second announcement text"  // ← STILL STUCK FOREVER
    },
    current: {
      "ann-welcome": "Welcome message",
      "ann-2": "Original text"  // ← Never got saved
    }
  }
}
```

**Console logs you might see (PROBLEM PATTERN):**

```
[CHECKPOINT 1] Saving announcement ann-1
...SUCCESS...
[DONE] Saving announcement ann-1 completed

[CHECKPOINT 1] Saving announcement ann-2
[API CALL] Sending PATCH request for announcement ann-2
...
[API RESPONSE] Response received for announcement ann-2
Status: 200 OK

[API SUCCESS] Announcement ann-2 response data: {id: "ann-2", announcement: "..."}
[FETCH] Fetching fresh announcements after save...

[FETCH] Getting fresh announcements from server
[FETCH] Fresh announcements from server: {ann-welcome: "...", ann-2: "ORIGINAL TEXT"}
                                                                        ↑
                                                                  WRONG TEXT!
```

**What this means:** API returned success (200 OK) but database shows old text = write was lost

---

## Scenario 3: Lock Serialization (Slow but Correct)

**Console pattern you'd see:**

```
[LOCK-WAIT] announcements-cache - ann-cache-1702345645012-abc123
Timestamp: 2025-12-12T15:30:44.900Z

[LOCK-WAITING] announcements-cache - ann-cache-1702345645012-abc123 - Waiting for previous operation...
[LOCK-ACQUIRED] announcements-cache - ann-cache-1702345645012-abc123
Timestamp: 2025-12-12T15:30:44.901Z

[LOCK-EXECUTING] announcements-cache - ann-cache-1702345645012-abc123 - Running function...

[SERVER LOCK ACQUIRED] Announcement PATCH: ann-1
Request ID: api-ann-ann-1-1702345645012
Timestamp: 2025-12-12T15:30:44.950Z

[SERVER] Reading current announcements...
[SERVER] Current announcements: {...}
[SERVER] Updating announcement ann-1 to: "First change..."
[SERVER] Writing to storage...
[SERVER] Updated announcements: {...}
[SERVER] Write result: {ok: true, persisted: 'supabase'}
[SERVER] Cache updated

[SERVER SUCCESS] Announcement ann-1 saved
Timestamp: 2025-12-12T15:30:45.100Z

[LOCK-EXEC-SUCCESS] announcements-cache - ann-cache-1702345645012-abc123 - Function completed successfully
[LOCK-RELEASED] announcements-cache - ann-cache-1702345645012-abc123
Timestamp: 2025-12-12T15:30:45.100Z

--- NEXT REQUEST STARTS ---

[LOCK-WAIT] announcements-cache - ann-cache-1702345645456-def789
Timestamp: 2025-12-12T15:30:45.200Z

[LOCK-WAITING] announcements-cache - ann-cache-1702345645456-def789 - Waiting for previous operation...
[LOCK-ACQUIRED] announcements-cache - ann-cache-1702345645456-def789
Timestamp: 2025-12-12T15:30:45.201Z

[LOCK-EXECUTING] announcements-cache - ann-cache-1702345645456-def789 - Running function...

[SERVER LOCK ACQUIRED] Announcement PATCH: ann-2
... (second change processes) ...

[SERVER SUCCESS] Announcement ann-2 saved
Timestamp: 2025-12-12T15:30:45.400Z
```

**What this means:**
- ✅ First lock acquired, executed, released (took ~200ms)
- ✅ Second lock waited for first to complete
- ✅ Second lock acquired, executed, released
- ✅ No race condition, both changes saved

**This pattern is GOOD even though it's slower!**

---

## Scenario 4: Broken Lock (Both Run Concurrently)

**Console pattern you'd see (BAD):**

```
[LOCK-WAIT] announcements-cache - ann-cache-1702345645012-abc123
[LOCK-WAITING] announcements-cache - ann-cache-1702345645012-abc123 - Waiting for previous operation...
[LOCK-ACQUIRED] announcements-cache - ann-cache-1702345645012-abc123

[LOCK-WAIT] announcements-cache - ann-cache-1702345645056-def789
[LOCK-WAITING] announcements-cache - ann-cache-1702345645056-def789 - Waiting for previous operation...
[LOCK-ACQUIRED] announcements-cache - ann-cache-1702345645056-def789
                                                    ↑
                                                  BOTH acquired at the same time!
                                                  This is bad.

[LOCK-EXECUTING] announcements-cache - ann-cache-1702345645012-abc123 - Running function...
[LOCK-EXECUTING] announcements-cache - ann-cache-1702345645056-def789 - Running function...
                                                                        ↑
                                                                      Both running!
                                                                      Race condition!
```

---

## How to Read Your Specific Scenario

### Use this checklist:

1. **After Checkpoint 1 (immediately):**
   - [ ] Pending empty or contains both changes?
   - [ ] Current shows both changes?
   - [ ] If yes to both → Working! ✅
   - [ ] If pending has one change but current shows old text → Problem! ❌

2. **After Checkpoint 2 (reload):**
   - [ ] Pending still empty?
   - [ ] Current still shows both?
   - [ ] If yes → Sync succeeded! ✅
   - [ ] If no → Something wrong with fetch/reload! ❌

3. **After Checkpoint 3 (2-3 min wait):**
   - [ ] Everything same as checkpoint 2?
   - [ ] If yes → Stable! ✅
   - [ ] If second change suddenly appeared → Delayed sync (eventual consistency) ⏳
   - [ ] If second change still missing → Lost forever! ❌

---

## Share This Exact Output

When reporting the issue, include the **complete** output from `window.syncDiagnostics()` at all three checkpoints. Copy the whole object, not screenshots.

Example of what to paste:

```
=== CHECKPOINT 1 (Immediately) ===
{
  timestamp: "2025-12-12T15:30:45.123Z",
  announcements: {
    pending: {...},
    current: {...}
  }
}

=== CHECKPOINT 2 (After reload) ===
{
  timestamp: "2025-12-12T15:31:20.456Z",
  announcements: {
    pending: {...},
    current: {...}
  }
}

=== CHECKPOINT 3 (After 2-3 min) ===
{
  timestamp: "2025-12-12T15:35:00.789Z",
  announcements: {
    pending: {...},
    current: {...}
  }
}
```

That's everything needed to diagnose the exact problem!
