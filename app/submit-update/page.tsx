import { Header } from '@/components/Header'
import { SubmitUpdateForm } from '@/components/SubmitUpdateForm'

export default function SubmitUpdatePage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Submit Club Update
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Help keep the Carlmont club catalog up to date by submitting changes or corrections.
            </p>
          </div>
          
          <SubmitUpdateForm />
        </div>
      </main>
    </div>
  )
}

