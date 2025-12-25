# New Utility Functions Reference

## Safe localStorage Operations

### File: `lib/storage-utils.ts`

#### `getStorageUsage(): number`
Returns current localStorage usage in bytes.
```typescript
import { getStorageUsage } from '@/lib/storage-utils'

const usage = getStorageUsage()
console.log(`Using ${usage} bytes`)
```

---

#### `isApproachingQuotaLimit(): boolean`
Checks if approaching 5MB limit (warning at 4MB).
```typescript
if (isApproachingQuotaLimit()) {
  console.warn('localStorage nearly full')
}
```

---

#### `safeGetJSON<T>(key: string, fallback: T): T`
Parse JSON with automatic fallback if key doesn't exist or parsing fails.
```typescript
const data = safeGetJSON('myKey', { default: 'value' })
// Returns parsed data or fallback if missing
```

---

#### `safeSetJSON<T>(key: string, value: T): Promise<boolean>`
Write JSON with quota checking and error handling.
```typescript
const success = await safeSetJSON('myKey', { data: 'value' })
if (!success) {
  console.error('Failed to save to localStorage')
}
```

---

#### `updateStorageObject<T>(key: string, updates: Partial<T> | ((current: T) => Partial<T>), fallback: T): Promise<boolean>`
**CRITICAL**: Atomic read-modify-write to prevent race conditions.
```typescript
// Update with object
await updateStorageObject('pending', { id1: true }, {})

// Update with function
await updateStorageObject('pending', (current) => ({
  ...current,
  [newId]: newValue
}), {})
```

---

#### `clearStorageByPrefix(prefix: string): number`
Delete all keys starting with prefix. Returns count deleted.
```typescript
const cleared = clearStorageByPrefix('montyclub:')
console.log(`Cleared ${cleared} keys`)
```

---

#### `getStorageKeys(prefix?: string): string[]`
Get all keys (optionally filtered by prefix).
```typescript
const allKeys = getStorageKeys()
const pendingKeys = getStorageKeys('montyclub:pending')
```

---

#### `migrateStorageKey(oldKey: string, newKey: string): boolean`
Safely move data from one key to another.
```typescript
migrateStorageKey('old:announcements', 'montyclub:announcements')
```

---

## File Upload & Size Management

### File: `lib/file-upload-utils.ts`

#### `validateFileSize(sizeBytes: number, fileType?: 'excel' | 'image' | 'general'): UploadValidationResult`
Check if file size is within limits.
```typescript
const result = validateFileSize(buffer.byteLength, 'excel')
if (!result.valid) {
  console.error(result.error)  // "File too large. Maximum size for excel files is 50 MB..."
}
```

---

#### `formatBytes(bytes: number): string`
Convert bytes to human-readable format.
```typescript
console.log(formatBytes(1048576))  // "1 MB"
console.log(formatBytes(5242880))  // "5 MB"
```

---

#### `getRequestSize(headers: Headers): number | null`
Get Content-Length from request headers.
```typescript
const size = getRequestSize(request.headers)
if (size && size > 50 * 1024 * 1024) {
  return NextResponse.json({ error: 'Too large' }, { status: 413 })
}
```

---

#### `validateExcelUpload(buffer: Buffer, options?: { maxSize?: number }): UploadValidationResult`
Validate Excel file before processing.
```typescript
const validation = validateExcelUpload(buffer)
if (!validation.valid) {
  return NextResponse.json({ error: validation.error }, { status: 413 })
}
console.log(validation.sizeReadable)  // "25.5 MB"
```

---

#### `safeReadRequestBody(request: Request, maxSize?: number): Promise<...>`
Safely read request body with size limit (checks header first).
```typescript
const body = await safeReadRequestBody(request, 50 * 1024 * 1024)
if (!body.success) {
  return NextResponse.json({ error: body.error }, { status: 413 })
}
// body.buffer is the safe Buffer
```

---

#### `disposeWorkbook(workbook: any): Promise<void>`
Clean up ExcelJS workbook to free memory.
```typescript
const workbook = new ExcelJS.Workbook()
await workbook.xlsx.read(buffer)
// ... process ...
await disposeWorkbook(workbook)  // Cleanup
```

---

#### `getMemoryStats(): { heapUsed: string; heapTotal: string; ... } | null`
Get current memory usage (Node.js only).
```typescript
const stats = getMemoryStats()
console.log(`Heap: ${stats.heapUsed} / ${stats.heapTotal}`)
```

---

#### `isMemoryLow(thresholdPercent?: number): boolean`
Check if heap usage is above threshold (default 90%).
```typescript
if (isMemoryLow(75)) {
  // Cleanup before processing large file
  global.gc?.()
}
```

---

#### `getFileSizeLimits()`
Get all configured file size limits.
```typescript
const limits = getFileSizeLimits()
// { excel: 52428800, image: 5242880, general: 104857600, 
//   readableExcel: "50 MB", ... }
```

---

## Authentication & Password Recovery

### File: `lib/auth.ts`

#### `generatePassword(length?: number): string`
Generate secure random password.
```typescript
const tempPassword = generatePassword(12)  // 12-char password with special chars
```

---

#### `hashPassword(password: string): string`
Hash password with PBKDF2 + random salt.
```typescript
const hash = hashPassword(userPassword)
// Returns: "salt:hash" (can be stored safely)
```

---

#### `verifyPassword(password: string, storedHash: string): boolean`
Verify password against stored hash.
```typescript
if (!verifyPassword(inputPassword, storedHash)) {
  return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
}
```

---

#### `generateResetToken(): string`
Generate cryptographically secure reset token (base64 URL-safe).
```typescript
const token = generateResetToken()  // 32 bytes = 256 bits entropy
```

---

#### `createPasswordResetToken(username: string, expiryMinutes?: number): string`
Create a one-time password reset token.
```typescript
const token = createPasswordResetToken('admin-user', 15)
// Share token with user (e.g., via email)
```

---

#### `verifyResetToken(token: string): string | null`
Validate reset token and return username if valid.
```typescript
const username = verifyResetToken(token)
if (!username) {
  return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 })
}
// Token is valid, allow password change for this user
```

---

#### `markResetTokenAsUsed(token: string): boolean`
Mark token as used after password reset (prevents reuse).
```typescript
if (markResetTokenAsUsed(token)) {
  // Token marked, old password is now invalid
}
```

---

#### `cleanupExpiredResetTokens(): number`
Remove expired tokens from memory. Call periodically.
```typescript
const cleaned = cleanupExpiredResetTokens()
console.log(`Cleaned up ${cleaned} expired tokens`)
```

---

#### `invalidateUserResetTokens(username: string): number`
Invalidate all reset tokens for a user (e.g., after manual password change).
```typescript
invalidateUserResetTokens('admin-user')
```

---

## Request Deduplication

### File: `lib/idempotency.ts`

#### `extractIdempotencyKey(request: NextRequest): string | null`
Extract Idempotency-Key from request headers.
```typescript
const key = extractIdempotencyKey(request)
if (key) {
  // This is a request with deduplication key
}
```

---

#### `getIdempotencyResult(key: string): { response: any; status: number } | null`
Check if request with this key has been processed.
```typescript
const cached = getIdempotencyResult(key)
if (cached) {
  return NextResponse.json(cached.response, { status: cached.status })
}
```

---

#### `storeIdempotencyResult(key: string, response: any, status: number): void`
Cache the result of processing an idempotency key.
```typescript
const result = await processRequest()
storeIdempotencyResult(key, result, 200)
```

---

#### `withIdempotency<T>(handler: ...): (request: NextRequest) => Promise<NextResponse<T>>`
Wrap route handler to add idempotency protection.
```typescript
export const POST = withIdempotency(async (request) => {
  const body = await request.json()
  // Process request
  return NextResponse.json(result)
})
```

---

#### `cleanupIdempotencyCache(): number`
Remove old cached entries (24-hour TTL). Call periodically.
```typescript
const cleared = cleanupIdempotencyCache()
```

---

#### `getIdempotencyCacheStats()`
Get cache statistics.
```typescript
const stats = getIdempotencyCacheStats()
// { size: 5, ttl: 86400000 }
```

---

## Request Optimization

### File: `lib/request-deduplication.ts`

#### `debounce<T>(func: T, delayMs: number): (...args) => void`
Delay function execution until calls stop.
```typescript
const debouncedSearch = debounce(async (query) => {
  const results = await search(query)
}, 500)

input.addEventListener('input', (e) => debouncedSearch(e.target.value))
```

---

#### `throttle<T>(func: T, delayMs: number): (...args) => void`
Limit execution frequency (e.g., scroll handler).
```typescript
const throttledResize = throttle(() => {
  recalculateLayout()
}, 100)

window.addEventListener('resize', throttledResize)
```

---

#### `createDebouncedFunction<T>(func: T, delayMs: number)`
Debounce with cancel/flush support.
```typescript
const debounced = createDebouncedFunction(save, 1000)

// In component cleanup
useEffect(() => {
  return () => debounced.cancel()
}, [])

// Before unmounting
debounced.flush()
```

---

#### `deduplicate<T>(func: T): (...args) => Promise<...>`
Prevent duplicate concurrent API calls.
```typescript
const deduplicatedFetch = deduplicate(async (id) => {
  return fetch(`/api/data/${id}`).then(r => r.json())
})

// Both calls return same promise
await deduplicatedFetch('123')
await deduplicatedFetch('123')  // Same result as above
```

---

#### `deduplicateById<T>(func: T, getIdFromArgs: (...args) => string)`
Deduplicate per unique ID.
```typescript
const toggleDeduplicated = deduplicateById(
  async (collectionId, enabled) => {
    return fetch('/api/collections', {
      method: 'PATCH',
      body: JSON.stringify({ id: collectionId, enabled })
    }).then(r => r.json())
  },
  (collectionId) => `toggle-${collectionId}`
)
```

---

#### `createBatcher<T, R>(batchFn: ..., delayMs?: number, maxBatchSize?: number)`
Accumulate requests and execute in batch.
```typescript
const batcher = createBatcher(
  async (items) => {
    return fetch('/api/batch', {
      method: 'POST',
      body: JSON.stringify(items)
    }).then(r => r.json())
  },
  100,   // Wait 100ms between batches
  50     // Or execute immediately at 50 items
)

// Add items
await batcher.add({ id: '1', action: 'create' })
await batcher.add({ id: '2', action: 'delete' })

// All bundled into 1 request
```

---

## Broadcast & Cross-Tab Communication

### File: `lib/broadcast.ts`

#### `broadcast(domain, action, payload?)`
Send message to all tabs (auto-queues if failed).
```typescript
broadcast('collections', 'update', { id: 'col-1', enabled: true })
// Automatically queues if receiving tab isn't ready
```

---

#### `createBroadcastListener(handler: (message) => void): () => void`
Listen for broadcast messages.
```typescript
const cleanup = createBroadcastListener((message) => {
  if (message.domain === 'collections') {
    // Update UI based on message.action and message.payload
  }
})

// Clean up on unmount
useEffect(() => {
  return cleanup
}, [])
```

---

#### `createDomainListener(domain, handler: (action, payload) => void): () => void`
Listen for specific domain only.
```typescript
const cleanup = createDomainListener('collections', (action, payload) => {
  if (action === 'update') {
    setCollections(prev => prev.map(c => c.id === payload.id ? {...c, ...payload} : c))
  }
})

useEffect(() => {
  return cleanup
}, [])
```

---

#### `getBroadcastQueueStats()`
Get queue statistics.
```typescript
console.log(getBroadcastQueueStats())
// { queuedMessages: 2, maxQueueSize: 100, seenMessagesInMemory: 5 }
```

---

#### `clearBroadcastQueue()`
Clear queued messages (for testing).
```typescript
clearBroadcastQueue()
```

---

#### `retryBroadcastQueue()`
Manually trigger retry of queued messages.
```typescript
retryBroadcastQueue()
```

---

## Summary

| Utility | Purpose | Import |
|---------|---------|--------|
| `updateStorageObject()` | Atomic localStorage updates | `lib/storage-utils` |
| `safeReadRequestBody()` | Safe file upload with size check | `lib/file-upload-utils` |
| `deduplicateById()` | Prevent duplicate API calls | `lib/request-deduplication` |
| `debounce()` | Delay function until calls stop | `lib/request-deduplication` |
| `createPasswordResetToken()` | Password recovery | `lib/auth` |
| `broadcast()` | Cross-tab messaging | `lib/broadcast` |
| `withIdempotency()` | Request deduplication | `lib/idempotency` |

All utilities are **typed**, **documented**, and **production-ready**.
