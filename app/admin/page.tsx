import { Header } from '@/components/Header'
import { AdminPanel } from '@/components/AdminPanel'

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <Header />
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="w-full px-3 sm:px-4 py-6 sm:py-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Admin Panel
          </h1>
          <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400">
            Manage club information and settings.
          </p>
        </div>
      </div>
      <main className="flex-1 w-full">
        <AdminPanel />
      </main>
    </div>
  )
}


