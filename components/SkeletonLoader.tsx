'use client'

export function SkeletonCard() {
  return (
    <div className="card p-4 sm:p-6 animate-pulse">
      <div className="flex items-start justify-between mb-3 gap-2">
        <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded w-3/4"></div>
        <div className="h-6 w-16 bg-gray-300 dark:bg-gray-700 rounded"></div>
      </div>
      
      <div className="space-y-2 mb-3">
        <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-full"></div>
        <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-5/6"></div>
      </div>
      
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 bg-gray-300 dark:bg-gray-700 rounded"></div>
          <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-32"></div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 bg-gray-300 dark:bg-gray-700 rounded"></div>
          <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-24"></div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 bg-gray-300 dark:bg-gray-700 rounded"></div>
          <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-28"></div>
        </div>
      </div>
    </div>
  )
}

export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
      <table className="w-full">
        <thead className="bg-gray-100 dark:bg-gray-800">
          <tr>
            {[1, 2, 3, 4].map((i) => (
              <th key={i} className="px-4 py-3">
                <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-20 animate-pulse"></div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i} className="border-t border-gray-200 dark:border-gray-700">
              {[1, 2, 3, 4].map((j) => (
                <td key={j} className="px-4 py-3">
                  <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded animate-pulse" style={{ width: `${60 + Math.random() * 40}%` }}></div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
