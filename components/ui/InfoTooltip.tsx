'use client'

import { HelpCircle } from 'lucide-react'

interface InfoTooltipProps {
  text: string
  linkHref?: string
  linkText?: string
  className?: string
}

export function InfoTooltip({ text, linkHref, linkText = 'Learn more', className = '' }: InfoTooltipProps) {
  return (
    <div className={`relative inline-block group ${className}`}> 
      <button
        type="button"
        aria-label="Help"
        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
      >
        <HelpCircle className="h-4 w-4" />
      </button>
      <div
        role="tooltip"
        className="hidden group-hover:block group-focus-within:block absolute z-50 bottom-full right-0 mb-2 w-64 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl text-xs text-gray-700 dark:text-gray-300"
      >
        <p className="leading-snug">{text}</p>
        {linkHref && (
          <a
            href={linkHref}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center text-primary-600 dark:text-primary-400 hover:underline"
          >
            {linkText}
          </a>
        )}
      </div>
    </div>
  )
}
