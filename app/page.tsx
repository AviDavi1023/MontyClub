import { Suspense } from 'react'
import { Header } from '@/components/Header'
import { ClubsList } from '@/components/ClubsList'
import { LoadingSpinner } from '@/components/LoadingSpinner'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-1 sm:mb-2">
            Carlmont Club Catalog
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
            Discover and explore clubs at Carlmont
          </p>
        </div>
        
        <Suspense fallback={<LoadingSpinner />}>
          <ClubsList />
        </Suspense>
      </main>
    </div>
  )
}


