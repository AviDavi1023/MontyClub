import { Header } from '@/components/Header'

export const metadata = {
  title: 'Privacy Notice | Carlmont Club Catalog',
  description: 'Privacy notice for Carlmont Club Catalog users and submitters.',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Privacy Notice</h1>
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-6">
          This notice explains what information the Carlmont Club Catalog collects and how it is used.
        </p>

        <section className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Information We Process</h2>
            <p>
              The catalog processes club registration details, update submissions, and admin management data required to run the
              school club directory.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">How Information Is Used</h2>
            <p>
              Data is used to review club submissions, publish approved clubs, support catalog operations, and maintain administrative
              audit logs.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Analytics</h2>
            <p>
              This site uses Vercel Analytics and Speed Insights for performance and usage monitoring. These services may process
              technical request metadata when analytics is enabled by deployment configuration.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Data Retention</h2>
            <p>
              Records are retained as needed for school club operations and may be removed by administrators through approved
              administrative workflows.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Contact</h2>
            <p>
              For questions about submitted data, contact the site administrator through the school club administration channel.
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}
