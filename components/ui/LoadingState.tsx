'use client'

import { ReactNode } from 'react'
import { LoadingSpinner } from '@/components/LoadingSpinner'

interface LoadingStateProps {
  message?: string
  children?: ReactNode
  className?: string
}

export function LoadingState({ 
  message = 'Loading...', 
  children,
  className = ''
}: LoadingStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 gap-4 ${className}`}>
      <LoadingSpinner />
      <div className="text-center">
        <p className="text-base text-gray-600 dark:text-gray-400 font-medium">
          {message}
        </p>
        {children && (
          <div className="mt-2 text-sm text-gray-500 dark:text-gray-500">
            {children}
          </div>
        )}
      </div>
    </div>
  )
}
