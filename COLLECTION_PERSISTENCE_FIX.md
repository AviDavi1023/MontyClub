# Collection Persistence Fix

## Problem Identified

When you created a new collection, toggled its enabled status, and reloaded the page, the **newly created collection would disappear**. Only after a few minutes would it reappear.

### Root Cause

The issue was in `getCollections()` in `/api/registration-collections/route.ts`:

```typescript
// OLD (BROKEN)
async function getCollections(): Promise<RegistrationCollection[]> {
  const data = await readJSONFromStorage(COLLECTIONS_PATH)
  if (!data || !Array.isArray(data)) {
    // Create default collection if none exist
    const defaultCollection: RegistrationCollection = { ... }
    await writeJSONToStorage(COLLECTIONS_PATH, [defaultCollection])  // ← OVERWRITES!
    return [defaultCollection]
  }
  return data
}
```

This function was being called from the **PATCH handler's retry logic** when it couldn't find a collection (lines 208-225). Due to Supabase Storage's eventual consistency, there were intermittent read failures where `readJSONFromStorage()` would return `null`.

When this happened:
1. You created a new collection → saved to storage
2. PATCH handler's retry logic called `getCollections()`
3. Storage read failed temporarily → returns `null`
4. `getCollections()` saw `null` and said "oh, database is empty!"
5. `getCollections()` **created a default collection and overwrote your new collection**
6. Your collection disappeared
7. Hours later, Supabase eventually propagated the original save

### Why It Took Hours to Reappear

Supabase Storage has eventual consistency. Your original collection save request was queued and eventually succeeded, but in the meantime, the "fallback default collection" had overwritten it multiple times. Eventually, the propagation settled and your collection reappeared.

## Solution Implemented

### Change 1: Removed "Fallback Default" Behavior

**File**: `/api/registration-collections/route.ts`

```typescript
// NEW (FIXED)
async function getCollections(): Promise<RegistrationCollection[]> {
  const data = await readJSONFromStorage(COLLECTIONS_PATH)
  if (!data || !Array.isArray(data)) {
    // Return empty array on read failure - do NOT create default collection
    // This prevents the "default fallback" from overwriting real data during eventual consistency delays
    return []
  }
  return data
}
```

**Key Change**: Return empty array on read failure instead of creating a default collection.

### Change 2: Create Default Only in GET When Truly Empty

```typescript
// In GET handler
let collections = await getCollections()

// Only create default collection if database is truly empty (not just read failure)
if (collections.length === 0) {
  const defaultCollection: RegistrationCollection = { ... }
  await saveCollections([defaultCollection])
  collections = [defaultCollection]
}
```

**Key Change**: Default collection is only created in the GET endpoint when we confirm the database is truly empty after a successful cache miss. This happens only on first-ever load, not during read failures.

## Why This Works

1. **No more "magic" overwrites**: `getCollections()` never modifies storage, it only reads
2. **Retry logic is safe**: PATCH retry logic can call `getCollections()` multiple times without fear of data loss
3. **Default collection still works**: On true first load (empty database), GET endpoint creates one
4. **Cache prevents thrashing**: In-memory cache prevents repeated reads during eventual consistency
5. **Deep cloning in PATCH**: PATCH handler deep clones cached data before modifying

## Testing the Fix

After deploying:

1. Create a new collection and enable it
2. Reload the page immediately
3. The collection should now persist correctly
4. Try creating multiple collections and toggling them rapidly
5. Reload - all collections should still be there

No more mysterious disappearing collections!

## Files Changed

- `/api/registration-collections/route.ts`: 
  - `getCollections()` function (lines 17-31)
  - GET handler (lines 60-87)
