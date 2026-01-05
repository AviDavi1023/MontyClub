# Optimistic UI Implementation Guide

## Current Status

The AdminPanel already uses optimistic updates with localStorage persistence (`montyclub:pendingCollectionChanges`). The system is partially correct but has several issues:

## Issues to Fix

### 1. **Revert on Error** ❌
Current: When API fails, the code reverts pending state
```typescript
// ❌ BAD: Reverts pending on error
catch (err) {
  setLocalPendingCollectionChanges(prev => {
    delete prev[collectionId]  // This is wrong!
    return prev
  })
}
```

**Should be**: Keep pending state in localStorage until it syncs
```typescript
// ✅ GOOD: Keep pending state for automatic retry
catch (err) {
  recordFailedOperation(...)  // Record for reconciliation
  showToast('Will retry automatically')
  // Don't revert!
}
```

### 2. **Rendering Doesn't Always Use Merged State** ⚠️
Some UI elements check: `localPendingCollectionChanges[id]?.field ?? collection.field`
Others just use: `collection.field`

**Should be**: Consistent everywhere
```typescript
// Use this pattern everywhere:
const effectiveValue = localPendingCollectionChanges[id]?.field ?? collection.field
```

### 3. **Error Handling** ⚠️
Current: Uses `recordFailedOperation()` but doesn't have systematic retry

**Should be**: Use the new `admin-optimistic-operations.ts` helpers

### 4. **Async Blocking** ⚠️
Current: Some code `await`s API calls
```typescript
// ❌ BAD: Blocks UI
const resp = await fetch(...)
await loadCollections()
showToast('Done')
```

**Should be**: Fire and forget with background sync
```typescript
// ✅ GOOD: Returns immediately
(async () => {
  try {
    const resp = await fetch(...)
    showToast('Success')
    setTimeout(() => loadCollections(), 300)
  } catch (err) {
    showToast('Will retry automatically')
  }
})()
```

## Implementation Strategy

### Phase 1: Fix Key Patterns (Already Partially Done)
✅ Collections toggles already use optimistic pattern
⚠️ Need to remove error reversion logic
⚠️ Need to ensure all renders use merged state

### Phase 2: Apply to Other Domains
- Registrations (approvals/denials)
- Announcements
- Updates

### Phase 3: Add Automatic Retry
- Use `recordFailedOperation()` which already exists
- System auto-retries on admin action

## Key Files to Understand

1. **[lib/optimistic-state.ts](../lib/optimistic-state.ts)** - Generic helpers
   - `mergeWithPending()` - Merge server + local
   - `getSyncStatus()` - Check what's synced
   - `autoSyncPending()` - Clear synced items
   - `createStateKey()` - Dependency tracking

2. **[lib/hooks/useOptimisticState.ts](../lib/hooks/useOptimisticState.ts)** - React hook
   - Provides `displayItems` (merged state)
   - Handles localStorage automatically
   - Auto-syncs when server catches up

3. **[lib/admin-optimistic-operations.ts](../lib/admin-optimistic-operations.ts)** - Operation helpers
   - `updateCollectionOptimistic()`
   - `approveRegistrationOptimistic()`
   - `denyRegistrationOptimistic()`

4. **[lib/sync-reconciliation.ts](../lib/sync-reconciliation.ts)** - Retry system
   - `recordFailedOperation()` - Save failed op
   - `retryFailedOperations()` - Auto-retry all failed ops

## Rendering Pattern

```tsx
// For collections:
const displayCollections = collections.map(c => ({
  ...c,
  enabled: localPendingCollectionChanges[c.id]?.enabled ?? c.enabled,
  accepting: localPendingCollectionChanges[c.id]?.accepting ?? c.accepting,
  display: localPendingCollectionChanges[c.id]?.display ?? c.display,
  renewalEnabled: localPendingCollectionChanges[c.id]?.renewalEnabled ?? c.renewalEnabled,
}))

// Then render using displayCollections, not collections
{displayCollections.map(c => (
  <Toggle
    checked={c.enabled}  // ← Already has pending overlay
    onChange={() => toggleCollectionEnabled(c.id)}
  />
))}
```

## Toggle Operation Pattern

```tsx
const toggleCollectionEnabled = async (collectionId: string) => {
  const collection = collections.find(c => c.id === collectionId)
  if (!collection) return
  
  // Step 1: Calculate next value using effective (merged) state
  const effectiveCurrentEnabled = localPendingCollectionChanges[collectionId]?.enabled ?? collection.enabled
  const nextEnabled = !effectiveCurrentEnabled
  
  // Step 2: Update pending immediately (optimistic)
  setLocalPendingCollectionChanges(prev => ({
    ...prev,
    [collectionId]: { ...(prev[collectionId] || {}), enabled: nextEnabled, _timestamp: Date.now() }
  }))
  // Save to localStorage
  localStorage.setItem(PENDING_KEY, JSON.stringify(...))
  
  // Step 3: Send API call in BACKGROUND (don't await)
  (async () => {
    try {
      const resp = await fetch('/api/registration-collections', {
        method: 'PATCH',
        body: JSON.stringify({ id: collectionId, enabled: nextEnabled })
      })
      
      if (!resp.ok) throw new Error('...')
      
      showToast('Updated')
      
      // Step 4: Reload from server (allows auto-sync to detect match)
      setTimeout(() => loadCollections(), 300)
    } catch (err) {
      // ✅ IMPORTANT: Do NOT revert pending state!
      showToast('Failed. Will retry automatically.')
    }
  })()
}
```

## Auto-Sync Logic (Already in AdminPanel)

When `loadCollections()` runs and fetches fresh data:

```typescript
useEffect(() => {
  if (Object.keys(localPendingCollectionChanges).length === 0) return
  
  // Auto-sync: check if server now matches pending
  const status = getSyncStatus(collections, localPendingCollectionChanges, c => c.id)
  
  if (status.isSynced) {
    // Clear localStorage for synced items
    localStorage.removeItem(PENDING_KEY)
    broadcast('collections', 'update', ...)
  }
}, [collections, localPendingCollectionChanges])
```

## Next Steps

1. ✅ Created `optimistic-state.ts` with generic helpers
2. ✅ Created `useOptimisticState.ts` hook (optional, for future refactoring)
3. ✅ Created `admin-optimistic-operations.ts` operation helpers
4. ⏳ Remove error reversion logic from toggle functions
5. ⏳ Ensure all renders use merged state consistently
6. ⏳ Apply pattern to registrations, announcements, updates
7. ⏳ Test end-to-end: Create collection → Toggle immediately → Verify UI reflects changes

## Testing Checklist

- [ ] Create new collection
- [ ] Immediately toggle enabled without waiting for API response
- [ ] UI shows toggle change instantly
- [ ] Even if API fails, UI still shows change
- [ ] Create new collection → Immediately toggle renewal without waiting
- [ ] Verify localStorage has pending changes
- [ ] Reload page → UI reflects pending changes
- [ ] Wait for auto-sync → localStorage cleared when server matches
- [ ] Multiple rapid toggles → All reflected correctly
- [ ] Offline scenario → Changes persist in localStorage, sync when online

