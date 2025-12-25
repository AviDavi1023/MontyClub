import { Suspense } from 'react'
import { Header } from '@/components/Header'
import { ClubsList } from '@/components/ClubsList'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import Link from 'next/link'
import { RefreshCcw, Edit } from 'lucide-react'

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
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-4">
            Discover and explore clubs at Carlmont
          </p>
          
          {/* Quick Actions */}
          <div className="flex flex-wrap gap-3">
            <Link 
              href="/renew-club"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <RefreshCcw className="h-4 w-4" />
              Renew Your Club
            </Link>
            <Link 
              href="/submit-update"
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Edit className="h-4 w-4" />
              Submit Update
            </Link>
          </div>
        </div>
        
        <Suspense fallback={<LoadingSpinner />}>
          <ClubsList />
        </Suspense>
      </main>
    </div>
  )
}


