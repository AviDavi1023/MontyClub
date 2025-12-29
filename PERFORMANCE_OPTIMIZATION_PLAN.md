# Performance Optimization Plan - Monty Club Catalog

## Performance Baseline Issues Identified

### 1. **Slow Front Page Loading (HIGH IMPACT)**
**Problem**: Loading ALL clubs at once with no pagination
- Every club card renders immediately (grid of 50+ cards?)
- Filtering/sorting happens in memory on all clubs
- No virtualization or lazy loading
- All club data fetched before page shows anything

**Current Flow**:
1. Page mounts → `loadClubs()` starts
2. Fetch `/api/clubs` (waits for full response)
3. Render 100+ `ClubCard` components at once
4. Filter/sort operations on full dataset in browser
5. All DOM nodes created before page interactive

**Impact**: Users see blank screen until all clubs load

---

### 2. **Slow Club Detail Page Loading (HIGH IMPACT)**
**Problem**: No loading indicator when navigating to club detail
- `ClubPage` is server-rendered but fetches ALL clubs (not just one)
- Renders full detail page without placeholder
- SimilarClubs component scores ALL clubs (expensive scoring logic)

**Current Flow**:
1. User clicks club card
2. No loading indicator appears (UI feels frozen)
3. Server fetches all clubs
4. SimilarClubs runs O(n²) comparison on all clubs
5. Page renders fully
6. User perceives 1-2s delay as "freeze"

**Impact**: Poor perceived responsiveness

---

### 3. **Slow Excel Import (MEDIUM-HIGH IMPACT)**
**Problem**: Synchronous Excel parsing on request thread
- Large Excel files (500+ rows) block the upload handler
- ExcelJS loads entire file into memory
- Validation and parsing all happen linearly
- Progress feedback missing

**Current Flow**:
1. User selects large Excel file
2. POST request starts
3. File loads into memory synchronously
4. ExcelJS parses entire workbook
5. Rows validated and written sequentially
6. Request blocks for 10-30 seconds
7. UI shows no progress

**Impact**: Users think upload failed, try again

---

### 4. **Inefficient Search/Filter (MEDIUM IMPACT)**
**Problem**: Runs on full dataset in browser, no debouncing issues
- Every keystroke filters all 100+ clubs
- Complex scoring logic on every sort
- No memoization of frequency maps
- Creating regex/text searches repeatedly

**Current**: Uses debouncing (good) but still processes everything

---

### 5. **Redundant Fetches (MEDIUM IMPACT)**
**Problem**: No deduplication of concurrent requests
- ClubsList mounts → calls `getClubs()`
- If multiple tabs or quick re-renders, multiple fetches happen
- No request collapsing/deduplication

---

### 6. **SimilarClubs Performance (MEDIUM IMPACT)**
**Problem**: Complex scoring logic runs on every render
- Tokenizes all clubs repeatedly
- Scores against all other clubs (O(n²))
- No memoization of similarity results
- Runs even if not visible

---

## Optimization Strategy

### Phase 1: Quick Wins (Perceived Performance)
1. **Add skeleton loaders** - Show immediate visual feedback
2. **Add page transitions** - Smooth animations reduce perceived lateness
3. **Add loading indicators on club detail** - Show something is loading

### Phase 2: Real Performance (Actual Speed)
4. **Pagination** - Load 10-20 clubs at a time, infinite scroll or pagination buttons
5. **Server-side caching** - Cache club list for 30-60 seconds
6. **Request deduplication** - Collapse concurrent `/api/clubs` requests
7. **SimilarClubs optimization** - Memoize and lazy load similarity scores

### Phase 3: Heavy Operations
8. **Excel parsing optimization** - Chunked processing, progress tracking
9. **QueryOptimization** - If using Supabase, optimize collection queries

---

## Detailed Changes

### A. Add Pagination (UI Layer)
**File**: `components/ClubsList.tsx`
- Add `page` state (currently showing page 1)
- Load 12-15 clubs per page
- Add "Load More" button or pagination controls
- Keep filtering/sorting but on paginated results

**Impact**: HIGH
- Reduces initial render from 100 nodes to 12
- Speeds up filter/sort operations
- Reduces memory usage

---

### B. Server-Side Caching
**File**: `lib/clubs.ts`
- Add 30-60 second cache for `fetchClubs()`
- Store in memory with timestamp
- Invalidate on admin actions

**Impact**: MEDIUM
- Prevents repeated parsing of same data
- Speeds up repeated page reloads
- Reduces Supabase calls

---

### C. Request Deduplication
**File**: `lib/clubs-client.ts`
- Collapse concurrent `getClubs()` calls
- Return same promise to multiple callers
- Handle race conditions

**Impact**: MEDIUM
- Prevents duplicate `/api/clubs` requests
- Saves bandwidth
- Improves load on backend

---

### D. Optimize SimilarClubs
**File**: `components/SimilarClubs.tsx`
- Memoize tokenization and scoring
- Lazy load scoring (defer after main content)
- Cache results

**Impact**: MEDIUM
- Speeds up club detail page by 200-500ms
- Reduces main thread blocking

---

### E. Skeleton Loaders & Loading States
**Files**: Multiple
- Show skeleton loaders immediately on page load
- Add spinner on club detail navigation
- Progressive rendering

**Impact**: HIGH (Perceived)
- Users see immediate feedback
- Feels 50% faster even if same actual time

---

### F. Excel Upload Progress
**File**: `app/api/upload-excel/route.ts`
- Implement chunked processing
- Send progress updates via Server-Sent Events (SSE)
- Show progress bar in UI

**Impact**: MEDIUM
- Users see what's happening
- Can estimate time remaining
- Feels faster even if same duration

---

## Implementation Priority

**Immediate (This Session)**:
1. ✅ Pagination - HIGH impact, LOW complexity
2. ✅ Loading states - HIGH perceived impact, LOW complexity
3. ✅ Server caching - MEDIUM impact, LOW complexity
4. ✅ Request deduplication - MEDIUM impact, MEDIUM complexity
5. ✅ SimilarClubs optimization - MEDIUM impact, LOW complexity

**Follow-up**:
6. Excel progress tracking (more complex, lower ROI)

---

## Expected Results

After all changes:
- **Page load**: 500ms → 200ms (65% faster, initial content visible)
- **Club detail navigation**: 1.5s → 600ms (60% faster)
- **Filtering**: 100ms → 20ms (80% faster)
- **Perceived speed**: ~70% improvement due to skeleton loaders
- **Excel upload**: Same duration but with progress feedback

---

## Rollout Plan

1. Implement pagination
2. Add skeleton loaders
3. Add server caching
4. Add request deduplication
5. Optimize SimilarClubs
6. Test with 100+ clubs
7. Deploy incrementally with monitoring

