# Read-After-Write Consistency Strategy

## Problem Statement

When creating a new registration collection, immediately attempting to toggle settings (like `renewalEnabled`) would fail with a 404 error. This occurred because:

1. **POST** creates collection → writes to Supabase Storage
2. **PATCH** (milliseconds later) reads from Supabase to update the same collection
3. **Supabase's eventual consistency** means the write hasn't propagated yet (300-500ms delay)
4. **Result**: Collection not found → 404 error

## Solution: Multi-Layered Consistency Strategy

We implement a **3-tier approach** to ensure admin operations always see the most recent state:

### 1. In-Memory Cache Layer (`collectionsCache`)

- **TTL**: 5 seconds
- **Scope**: Per serverless worker
- **Purpose**: Instant read-after-write consistency within same worker
- **Location**: `lib/caches.ts`

```typescript
export const collectionsCache = new ApiCache<RegistrationCollection[]>('collections-cache')
```

### 2. Write Timestamp Tracking

- Track when collections were last written (`lastWriteTimestamp`)
- Use this to detect "recent write" scenarios
- Adjust retry behavior based on recency

```typescript
// After successful write
collectionsCache.set(collections)
lastWriteTimestamp = Date.now()
```

### 3. Enhanced Retry Logic

When reading collections:

- **Normal case**: 3 retries, 100ms base delay
- **Recent write case** (< 3 seconds): 8 retries, 150ms base delay
- **Exponential backoff**: Each retry waits longer (100ms → 200ms → 400ms...)

```typescript
const timeSinceLastWrite = Date.now() - lastWriteTimestamp
const wasRecentWrite = timeSinceLastWrite < 3000
const maxAttempts = wasRecentWrite ? 8 : 3
const baseDelay = wasRecentWrite ? 150 : 100
```

## How It Works: Request Flow

### Scenario: Create Collection → Immediately Toggle Renewal

#### Step 1: POST Creates Collection
```
POST /api/registration-collections
  ↓
QueueLock.withLock() → Sequential processing
  ↓
saveCollections() writes to Supabase
  ↓
✅ Cache updated: collectionsCache.set(collections)
✅ Timestamp recorded: lastWriteTimestamp = Date.now()
  ↓
Return success
```

#### Step 2: PATCH Toggles Renewal (50ms later)
```
PATCH /api/registration-collections
  ↓
QueueLock.withLock() → Waits for POST to finish
  ↓
getCollections() called:
  1️⃣ Check cache first (5-second TTL)
     → Cache hit! Return immediately
     ✅ Collection found instantly
  
  OR (if different worker):
  
  2️⃣ Check lastWriteTimestamp
     → Recent write detected (50ms ago)
     → Use aggressive retry: 8 attempts, 150ms base delay
  3️⃣ Retry reading from Supabase with exponential backoff:
     - Attempt 1: Read → not found → wait 150ms
     - Attempt 2: Read → not found → wait 300ms
     - Attempt 3: Read → found! ✅
  
  ↓
Collection found → Apply toggle → Save
  ↓
Return success
```

## Cache Invalidation

Cache is automatically invalidated:
- After 5 seconds (TTL expires)
- When explicitly cleared via `clearCollectionsCache()`
- On DELETE operations (to force fresh read)

## Benefits

✅ **Immediate consistency** within same serverless worker (cache hit)
✅ **Eventual consistency handling** across workers (aggressive retries)
✅ **Zero user-facing errors** for rapid operations
✅ **Automatic fallback** to eventual consistency model
✅ **Performance optimization** (reduces Supabase reads)

## Monitoring

Check console logs for:
```json
{"tag": "collections-read", "step": "cache-hit", "count": 5}
{"tag": "collections-read", "step": "read-start", "wasRecentWrite": true, "timeSinceLastWrite": 50, "maxAttempts": 8}
{"tag": "collections-persistence", "step": "write-succeeded", "cacheUpdated": true, "timestamp": 1704470400000}
```

## Edge Cases Handled

1. **Multiple rapid toggles**: Queue lock ensures sequential processing
2. **Cross-worker writes**: Aggressive retry strategy compensates for lack of shared cache
3. **Failed writes**: Cache not updated, next read fetches from Supabase
4. **Cache staleness**: 5-second TTL ensures bounded staleness
5. **Supabase outage**: Retry logic with exponential backoff prevents immediate failure

## Future Enhancements

If needed, could add:
- Redis-based cache for cross-worker consistency (via Vercel KV)
- WebSocket notifications for real-time cross-worker updates
- Optimistic locking with version numbers (CAS pattern)
- Circuit breaker for Supabase failures
