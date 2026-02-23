'use client'

import { usePathname } from 'next/navigation'

export function Footer() {
  const pathname = usePathname()
  const isAdminPage = pathname?.startsWith('/admin')
  
  // Don't show footer on admin pages
  if (isAdminPage) return null
  
  const year = new Date().getFullYear()
  return (
    <footer className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 mt-8">
      <div className="container mx-auto px-3 sm:px-4 py-6 text-center text-xs sm:text-sm text-gray-500 dark:text-gray-400">
        <p>&copy; {year} Carlmont Club Catalog. Built by Avi Davidovits.</p>
      </div>
    </footer>
  )
}
