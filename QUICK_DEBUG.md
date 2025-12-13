# 🔍 Quick Debug Commands - Copy & Paste These

## Three Simple Steps to Debug

### Step 1️⃣: Right After Making Changes
**Copy this into browser console (F12) and paste:**
```javascript
window.syncDiagnostics()
```

### Step 2️⃣: After Reloading Page
**Run the same command:**
```javascript
window.syncDiagnostics()
```

### Step 3️⃣: After Waiting 2-3 Minutes
**Run again:**
```javascript
window.syncDiagnostics()
```

---

## Other Helpful Commands

### See Just Announcements
```javascript
window.getAnnouncementsPending()
```

### See Just Updates
```javascript
window.getUpdatesPending()
```

### See Just Collections
```javascript
window.getCollectionsPending()
```

### See Everything Pending
```javascript
window.getAllPending()
```

---

## What the Output Means

If you see this after step 1️⃣:
```
Pending announcements: { ann-2: "second announcement" }
Current announcements: { ann-1: "first...", ann-2: "original..." }
```

❌ **Problem:** Second change is stuck pending (text mismatch = didn't save)

---

If you see this after step 1️⃣:
```
Pending announcements: {}
Current announcements: { ann-1: "first...", ann-2: "second..." }
```

✅ **Fixed:** Both changes are in the database!

---

## Expected Flow

### Checkpoint 1 (Immediately):
- Both changes should appear in the "Pending" section
- OR both should be empty (if sync was instant)

### Checkpoint 2 (After Reload):
- Pending should be empty (cleared on reload)
- Current should show both changes

### Checkpoint 3 (After 2-3 min):
- Pending still empty
- Current still shows both changes

---

## Share These 3 Outputs With Support

When you report the issue, paste:
1. Output from Step 1️⃣
2. Output from Step 2️⃣
3. Output from Step 3️⃣

That's it! That's all we need to diagnose the problem.

---

## Console Tab Pro Tips

- **Clear old logs:** `clear()` (then make changes)
- **Search logs:** Cmd+F (on Mac) or Ctrl+F (on Windows) → type "LOCK" to see lock messages
- **Copy all logs:** Ctrl+A → Ctrl+C (in console)
- **Expand groups:** Click the ▶ arrows next to grouped logs

---

## If You See Errors

Red error messages in the console are important! 

**Copy the entire error** (including the stack trace) and share it.

Example of what to look for:
```
TypeError: Cannot read properties of undefined
  at saveAnnouncement (AdminPanel.tsx:1234)
```

---

## Video: What to Record

If you want to record a video:
1. Start screen recording
2. Open Admin Panel
3. Open console (F12)
4. Make two announcement changes rapidly
5. Run `window.syncDiagnostics()`
6. Show the output
7. Reload page
8. Run command again
9. Share video link

That gives us everything we need!

---

## Questions?

- 🔒 Locks working? → Look for `[LOCK-ACQUIRED]` messages
- 📝 Changes saving? → Check if text matches in `window.syncDiagnostics()`
- 🔄 Auto-clear working? → Pending should go to empty after refresh
- 💾 localStorage working? → Check browser DevTools > Application > Local Storage

---

**That's it! Just run those 3 commands and share the output. We'll figure it out! 🚀**
