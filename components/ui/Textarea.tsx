'use client'

import { TextareaHTMLAttributes, ReactNode, forwardRef } from 'react'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  icon?: ReactNode
  helperText?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea(
    {
      label,
      error,
      icon,
      helperText,
      className = '',
      ...props
    },
    ref
  ) {
    const valueLen = typeof props.value === 'string' ? props.value.length : 0
    const maxLen = typeof props.maxLength === 'number' ? props.maxLength : undefined
    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={props.id}
            className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2"
          >
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}

        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-3 text-gray-400 pointer-events-none">
              {icon}
            </div>
          )}

          <textarea
            ref={ref}
            className={`w-full px-${icon ? '10' : '3'} py-2.5 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200 ${
              error
                ? 'border-red-300 dark:border-red-600 focus:ring-red-500'
                : 'border-gray-300 dark:border-gray-600'
            } ${className}`}
            aria-invalid={!!error}
            aria-describedby={error ? `${props.id}-error` : undefined}
            {...props}
          />
        </div>

        {error && (
          <p id={`${props.id}-error`} role="alert" aria-live="polite" className="text-sm text-red-600 dark:text-red-400 mt-1">
            {error}
          </p>
        )}

        {(!error && (helperText || typeof maxLen === 'number')) && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 flex items-center justify-between">
            <span>{helperText}</span>
            {typeof maxLen === 'number' && (
              <span className="text-xs text-gray-400 dark:text-gray-500">{valueLen}/{maxLen}</span>
            )}
          </p>
        )}
      </div>
    )
  }
)

Textarea.displayName = 'Textarea'
