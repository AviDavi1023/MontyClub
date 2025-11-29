"use client"

import React from 'react'

type ToggleProps = {
  checked: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
  label?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function Toggle({ checked, onChange, disabled, label, size = 'md', className = '' }: ToggleProps) {
  const sizes = {
    sm: { track: 'w-9 h-5', knob: 'w-4 h-4', translate: 'translate-x-4', ring: 'ring-2' },
    md: { track: 'w-11 h-6', knob: 'w-5 h-5', translate: 'translate-x-5', ring: 'ring-2' },
    lg: { track: 'w-14 h-7', knob: 'w-6 h-6', translate: 'translate-x-7', ring: 'ring-2' },
  } as const
  const s = sizes[size]

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`inline-flex items-center ${label ? 'gap-2' : ''} ${className}`}
    >
      <span
        className={`relative ${s.track} flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 
        ${checked ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'}
        ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
      >
        <span
          className={`absolute left-0 top-1/2 -translate-y-1/2 inline-block ${s.knob} rounded-full bg-white shadow transform transition-transform duration-200 
          ${checked ? s.translate : 'translate-x-1'}`}
        />
      </span>
      {label && (
        <span className="text-sm text-gray-900 dark:text-gray-100 select-none">{label}</span>
      )}
    </button>
  )
}
