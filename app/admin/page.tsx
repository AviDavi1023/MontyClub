import { Header } from '@/components/Header'
import { AdminPanel } from '@/components/AdminPanel'

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-1 sm:mb-2">
              Admin Panel
            </h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
              Manage club information and settings.
            </p>
          </div>
          
          <AdminPanel />
        </div>
      </main>
    </div>
  )
}


