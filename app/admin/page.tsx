import { Header } from '@/components/Header'
import { AdminPanel } from '@/components/AdminPanel'

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <Header />
      <main className="flex-1 w-full flex flex-col">
        {/* Admin Panel - Full Width */}
        <div className="flex-1 w-full">
          <AdminPanel />
        </div>
      </main>
    </div>
  )
}


