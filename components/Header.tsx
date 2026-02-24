'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import { ThemeToggle } from '@/components/ThemeToggle'

export function Header() {
  const pathname = usePathname()
  const isAdminPage = pathname === '/admin'
  const isUpdatePage = pathname === '/submit-update'

  return (
    <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
      <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
        <div className="flex items-center justify-between gap-2">
          <Link href="/" className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-shrink">
            <Image
              src="/Carlmont_logo_outline.png"
              alt="Carlmont Logo"
              width={32}
              height={32}
              className="sm:w-10 sm:h-10 flex-shrink-0"
            />
            <span className="text-base sm:text-xl font-bold text-gray-900 dark:text-white truncate">
              Carlmont Club Catalog
            </span>
          </Link>
          
          <nav className="flex items-center gap-3 sm:gap-6 flex-shrink-0">
            <Link 
              href="/submit-update" 
              className={`relative text-xs sm:text-sm transition-colors whitespace-nowrap ${
                isUpdatePage
                  ? 'text-gray-900 dark:text-white font-medium'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <span className="hidden sm:inline">Submit Club Update</span>
              <span className="sm:hidden">Update</span>
              {isUpdatePage && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 dark:bg-primary-400" />
              )}
            </Link>
            <Link 
              href="/admin" 
              className={`relative text-xs sm:text-sm transition-colors ${
                isAdminPage
                  ? 'text-gray-900 dark:text-white font-medium'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Admin
              {isAdminPage && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 dark:bg-primary-400" />
              )}
            </Link>
            <ThemeToggle />
          </nav>
        </div>
      </div>
    </header>
  )
}
