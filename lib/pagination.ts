import { useMemo } from 'react'

export interface PaginationOptions {
  itemsPerPage: number
  currentPage: number
}

export interface PaginationResult<T> {
  items: T[]
  currentPage: number
  totalPages: number
  totalItems: number
  hasNextPage: boolean
  hasPrevPage: boolean
  startIndex: number
  endIndex: number
}

/**
 * Hook for paginating arrays
 * Memoizes results to prevent unnecessary re-renders
 */
export function usePagination<T>(
  items: T[],
  currentPage: number = 1,
  itemsPerPage: number = 12
): PaginationResult<T> {
  return useMemo(() => {
    const totalItems = items.length
    const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage))
    
    // Clamp current page to valid range
    const clampedPage = Math.max(1, Math.min(currentPage, totalPages))
    
    const startIndex = (clampedPage - 1) * itemsPerPage
    const endIndex = Math.min(startIndex + itemsPerPage, totalItems)
    
    return {
      items: items.slice(startIndex, endIndex),
      currentPage: clampedPage,
      totalPages,
      totalItems,
      hasNextPage: clampedPage < totalPages,
      hasPrevPage: clampedPage > 1,
      startIndex,
      endIndex,
    }
  }, [items, currentPage, itemsPerPage])
}

/**
 * Hook for infinite scroll (load more) pagination
 * Returns items loaded so far, plus helpers for loading more
 */
export function useInfiniteLoad<T>(
  allItems: T[],
  itemsPerLoad: number = 12
) {
  return useMemo(() => {
    return {
      itemsPerLoad,
      loadMore: (currentLoadedCount: number) => currentLoadedCount + itemsPerLoad,
      getLoadedItems: (count: number) => allItems.slice(0, count),
      hasMore: (loadedCount: number) => loadedCount < allItems.length,
      remaining: (loadedCount: number) => Math.max(0, allItems.length - loadedCount),
    }
  }, [allItems, itemsPerLoad])
}
