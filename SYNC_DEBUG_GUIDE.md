# Comprehensive Sync Debugging Guide

## Quick Start - Three Commands to Run

### 1️⃣ Immediately After Making Changes (While "Syncing")

**Open browser console** (F12 → Console tab) and paste:

```javascript
window.syncDiagnostics()
```

**This shows:**
- What announcements are "pending" in localStorage
- What announcements are actually in the database
- The delta between them

---

### 2️⃣ Reload the Page Right After Making Changes

**Before reload, run in console:**

```javascript
window.getAllPending()
```

**Then reload** (F5 or Cmd+R)

**After reload, run:**

```javascript
window.getAllPending()
```

**This shows:**
- Did pending changes persist across reload?
- Are they in localStorage?
- Are they getting cleared automatically?

---

### 3️⃣ Wait 2-3 Minutes for Database to Sync, Then Reload

**Run in console:**

```javascript
window.syncDiagnostics()
```

**This shows:**
- Did the database eventually get the second change?
- Is it there now but just delayed?
- Or is it completely missing?

---

## What to Look For

### Scenario A: Everything Works ✅

```
ANNOUNCEMENTS STATE ===
Pending announcements: {}  ← Empty (good!)
Current announcements: {
  "ann1": "First change saved",
  "ann2": "Second change saved"
}
```

**Meaning:** Both changes made it to the database

---

### Scenario B: First Change Saved, Second Lost ❌

```
ANNOUNCEMENTS STATE ===
Pending announcements: {
  "ann2": "Second change text"  ← Still pending!
}
Current announcements: {
  "ann1": "First change saved",
  "ann2": "Original text"  ← Second change overwritten
}
```

**Meaning:** Race condition - second write lost

---

### Scenario C: Lock Serialization Issue 🔒

Look at console logs for patterns like:

```
[LOCK-WAIT] announcements-cache - ann-12345
[LOCK-WAITING] announcements-cache - ann-12345 - Waiting for previous operation...
[LOCK-ACQUIRED] announcements-cache - ann-12345
...VERY LONG DELAY...
[LOCK-RELEASED] announcements-cache - ann-12345

[LOCK-WAIT] announcements-cache - ann-67890
[LOCK-WAITING] announcements-cache - ann-67890 - Waiting for previous operation...
[LOCK-ACQUIRED] announcements-cache - ann-67890
```

**Meaning:** Locks are working but serializing requests

---

## Detailed Console Output Explanation

### Frontend Logs (Browser Console)

```
[CHECKPOINT 1] Saving announcement ann-1
Request ID: ann-ann-1-1702345678901
Text: "My announcement text..."
Timestamp: 2025-12-12T15:30:45.123Z

💾 SAVE ANNOUNCEMENT - Saving to localStorage: {ann-1: "..."}
✅ Announcements localStorage saved successfully

[API CALL] Sending PATCH request for announcement ann-1
URL: /api/announcements/ann-1
Method: PATCH
Body: {"announcement":"My announcement text..."}
Timestamp: 2025-12-12T15:30:45.456Z

[API RESPONSE] Response received for announcement ann-1
Status: 200 OK
Time taken: 245ms
Timestamp: 2025-12-12T15:30:45.701Z

[API SUCCESS] Announcement ann-1 response data: {id: "ann-1", announcement: "..."}

[FETCH] Fetching fresh announcements after save...

[FETCH] Getting fresh announcements from server
Timestamp: 2025-12-12T15:30:45.800Z
Response status: 200
Time taken: 156ms

[FETCH] Fresh announcements from server: {ann-1: "My announcement text..."}
[FETCH] Keys: ann-1

[DONE] Saving announcement ann-1 completed
```

### Server Logs (Terminal/Deployment Logs)

```
============================================================
[SERVER LOCK ACQUIRED] Announcement PATCH: ann-1
Request ID: api-ann-ann-1-1702345678901
Timestamp: 2025-12-12T15:30:45.500Z
============================================================

[SERVER] Reading current announcements...
[SERVER] Current announcements: {existing_ann: "existing text"}

[SERVER] Updating announcement ann-1 to: "My announcement text..."
[SERVER] Writing to storage...
[SERVER] Updated announcements: {existing_ann: "...", ann-1: "My announcement text..."}
[SERVER] Write result: {ok: true, persisted: 'supabase'}
[SERVER] Cache updated

============================================================
[SERVER SUCCESS] Announcement ann-1 saved
Timestamp: 2025-12-12T15:30:45.700Z
============================================================
```

---

## How to Reproduce and Capture Logs

### Step-by-Step

1. **Open Admin Panel** in browser
2. **Open Developer Tools** (F12)
3. **Go to Console tab**
4. **Run diagnostics command:**
   ```javascript
   window.syncDiagnostics()
   ```
   Copy the output

5. **Make first announcement change** (e.g., edit announcement A)
6. **Immediately make second change** (e.g., edit announcement B within 500ms)
7. **Still in console, run:**
   ```javascript
   window.syncDiagnostics()
   ```
   Copy the output

8. **Look at console logs** for the `[LOCK-*]` and `[API-*]` messages

9. **Reload page** (F5)
10. **After reload, run:**
    ```javascript
    window.syncDiagnostics()
    ```
    Copy the output

11. **Wait 2 minutes**, then **reload again**
12. **Run diagnostics** one more time

---

## What Info to Share

When reporting the issue, provide:

### ✅ Always Include:

1. **Browser type and version** (Chrome 131, Safari 18, etc.)
2. **Three snapshots:**
   - **Checkpoint 1:** Immediately after making 2 changes
   - **Checkpoint 2:** After reloading page
   - **Checkpoint 3:** After waiting 2+ minutes and reloading

3. **Console output** from `window.syncDiagnostics()` at each checkpoint
4. **Complete console log** (copy all text from console)

### ✅ Optional but Helpful:

- Screenshot of announcements panel showing pending vs. saved
- Which announcements were changed (IDs)
- Any error messages in red in the console
- Network tab showing the API requests (DevTools → Network tab)

---

## Automated Log Collection

You can also access logs from the debug logger:

```javascript
// Get all logs as formatted text
window.debugLogger.getLogs()

// Get logs as JSON
window.debugLogger.getLogsJSON()

// Copy logs to clipboard
window.debugLogger.copyToClipboard()

// Print formatted logs
window.debugLogger.print()

// Clear logs
window.debugLogger.clear()
```

---

## Common Issues to Check

### Issue: "Syncing" badge never disappears

**Check:** `window.syncDiagnostics()`

Look for announcements in `Pending` but not in `Current`. Example:

```javascript
{
  announcements: {
    pending: { "ann-123": "pending text" },
    current: { "ann-123": "old text" }  // ← Mismatch!
  }
}
```

**This means:** The change didn't make it to the database

---

### Issue: Only first change works

**Check:** Server logs for lock behavior

Look for:

```
[LOCK-ACQUIRED] ann-cache - op1 - Running function...
[LOCK-RELEASED] ann-cache - op1

[LOCK-ACQUIRED] ann-cache - op2 - Running function...  ← Did this happen?
```

If op2 never shows `LOCK-ACQUIRED`, it means the lock is broken.

---

### Issue: Changes keep disappearing after reload

**Check:** LocalStorage persistence

Run:

```javascript
JSON.parse(localStorage.getItem('montyclub:pendingAnnouncements'))
```

If this is empty before reload but had data before, localStorage isn't persisting properly.

---

## Advanced: Manual Lock Testing

Test if locks are working:

```javascript
// In browser console, simulate rapid requests
for (let i = 0; i < 3; i++) {
  fetch(`/api/announcements/test-${i}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ announcement: `Test ${i}` })
  }).then(r => r.json()).then(d => console.log(`Request ${i}:`, d))
}
```

**Good output:** 3 successful responses, with `[LOCK-ACQUIRED]` messages spaced apart  
**Bad output:** All 3 responses come in quickly without `[LOCK-ACQUIRED]` messages = lock is broken

---

## Questions to Answer With These Logs

1. ✅ Are both changes being sent to the API?
2. ✅ Are both changes being received by the API?
3. ✅ Are both changes being written to the database?
4. ✅ Are both changes readable when we fetch after?
5. ✅ Is the auto-clear mechanism working?
6. ✅ Is localStorage persisting pending changes?

The logs will answer all of these!
