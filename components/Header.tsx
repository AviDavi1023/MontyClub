import Link from 'next/link'
import { ThemeToggle } from '@/components/ThemeToggle'

export function Header() {
  return (
    <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-gray-900 dark:text-white">
            Carlmont Club Catalog
          </Link>
          
          <nav className="flex items-center space-x-4">
            <Link 
              href="/submit-update" 
              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Submit Update
            </Link>
            <Link 
              href="/admin" 
              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Admin
            </Link>
            <ThemeToggle />
          </nav>
        </div>
      </div>
    </header>
  )
}
