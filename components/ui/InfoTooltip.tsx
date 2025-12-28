'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { HelpCircle } from 'lucide-react'

interface InfoTooltipProps {
  text: string
  linkHref?: string
  linkText?: string
  className?: string
}

export function InfoTooltip({ text, linkHref, linkText = 'Learn more', className = '' }: InfoTooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0, placement: 'top' as 'top' | 'bottom' })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isVisible || !buttonRef.current || !tooltipRef.current) return

    const updatePosition = () => {
      const button = buttonRef.current
      const tooltip = tooltipRef.current
      if (!button || !tooltip) return

      const buttonRect = button.getBoundingClientRect()
      const tooltipRect = tooltip.getBoundingClientRect()
      const viewportHeight = window.innerHeight
      const viewportWidth = window.innerWidth
      
      // Calculate space above and below
      const spaceAbove = buttonRect.top
      const spaceBelow = viewportHeight - buttonRect.bottom
      const tooltipHeight = tooltipRect.height || 120 // estimate if not rendered yet

      // Determine placement
      let placement: 'top' | 'bottom' = 'top'
      let top = 0
      
      if (spaceAbove >= tooltipHeight + 8) {
        // Enough space above
        placement = 'top'
        top = buttonRect.top - tooltipHeight - 8
      } else if (spaceBelow >= tooltipHeight + 8) {
        // Not enough space above, use below
        placement = 'bottom'
        top = buttonRect.bottom + 8
      } else {
        // Use the side with more space
        placement = spaceAbove > spaceBelow ? 'top' : 'bottom'
        top = placement === 'top' 
          ? Math.max(8, buttonRect.top - tooltipHeight - 8)
          : buttonRect.bottom + 8
      }

      // Calculate left position (align to right edge of button, but ensure it stays in viewport)
      let left = buttonRect.right - 256 // 256px = w-64
      if (left < 8) left = 8
      if (left + 256 > viewportWidth - 8) left = viewportWidth - 256 - 8

      setPosition({ top, left, placement })
    }

    updatePosition()
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)

    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [isVisible])

  const tooltipContent = isVisible && typeof document !== 'undefined' ? createPortal(
    <div
      ref={tooltipRef}
      role="tooltip"
      style={{
        position: 'fixed',
        top: `${position.top}px`,
        left: `${position.left}px`,
        zIndex: 9999,
      }}
      className="w-64 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl text-xs text-gray-700 dark:text-gray-300 animate-in fade-in zoom-in-95 duration-150"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      <p className="leading-snug">{text}</p>
      {linkHref && (
        <a
          href={linkHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center text-primary-600 dark:text-primary-400 hover:underline text-xs"
        >
          {linkText}
        </a>
      )}
    </div>,
    document.body
  ) : null

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label="Help"
        className={`text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors ${className}`}
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
      >
        <HelpCircle className="h-4 w-4" />
      </button>
      {tooltipContent}
    </>
  )
}
