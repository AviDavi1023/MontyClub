import { Header } from '@/components/Header'

export const metadata = {
  title: 'Terms of Use | Carlmont Club Catalog',
  description: 'Terms of use for Carlmont Club Catalog.',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Terms of Use</h1>
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-6">
          By using this site, you agree to use it only for legitimate school club catalog and update purposes.
        </p>

        <section className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Acceptable Use</h2>
            <p>
              Do not submit false, misleading, abusive, or unauthorized content. Admin users must manage records responsibly.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Submission Accuracy</h2>
            <p>
              Submitters are responsible for the accuracy of registration and update information they provide.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Administrative Control</h2>
            <p>
              Administrators may approve, reject, edit, or remove submissions in accordance with school processes.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Service Changes</h2>
            <p>
              Features, data, and access controls may be modified to maintain reliability, safety, and policy compliance.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Disclaimer</h2>
            <p>
              This site is provided for school operational use. Availability and content are provided on an as-is basis.
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}
