'use client'

/**
 * Skeleton loader for club detail page
 * Shows while club data is loading
 */
export function ClubDetailSkeleton() {
  return (
    <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8 animate-pulse">
      {/* Back Button Skeleton */}
      <div className="h-4 w-24 bg-gray-300 dark:bg-gray-700 rounded"></div>

      {/* Club Header Card */}
      <div className="card p-4 sm:p-6 space-y-4">
        {/* Title and Status */}
        <div className="space-y-3">
          <div className="h-8 bg-gray-300 dark:bg-gray-700 rounded w-3/4"></div>
          <div className="flex items-center gap-2">
            <div className="h-6 w-20 bg-gray-300 dark:bg-gray-700 rounded-full"></div>
            <div className="h-6 w-16 bg-gray-300 dark:bg-gray-700 rounded-full"></div>
          </div>
        </div>

        {/* Share Button */}
        <div className="flex justify-end">
          <div className="h-10 w-32 bg-gray-300 dark:bg-gray-700 rounded-lg"></div>
        </div>
      </div>

      {/* Description Section */}
      <div className="card p-4 sm:p-6 space-y-3">
        <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-full"></div>
        <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-5/6"></div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card p-4 sm:p-6 space-y-2">
            <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-1/3"></div>
            <div className="h-5 bg-gray-300 dark:bg-gray-700 rounded w-5/6"></div>
          </div>
        ))}
      </div>

      {/* Similar Clubs Section */}
      <div className="card p-4 sm:p-6">
        <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded w-32 mb-4"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card p-4 sm:p-6 space-y-3">
              <div className="h-5 bg-gray-300 dark:bg-gray-700 rounded"></div>
              <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-5/6"></div>
              <div className="space-y-2">
                <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded"></div>
                <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded w-4/5"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
