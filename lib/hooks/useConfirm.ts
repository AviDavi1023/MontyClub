'use client'

import { useState, useCallback } from 'react'

interface UseConfirmOptions {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'primary'
}

export function useConfirm() {
  const [isOpen, setIsOpen] = useState(false)
  const [options, setOptions] = useState<UseConfirmOptions | null>(null)
  const [resolveCallback, setResolveCallback] = useState<((value: boolean) => void) | null>(null)

  const confirm = useCallback((opts: UseConfirmOptions): Promise<boolean> => {
    setOptions(opts)
    setIsOpen(true)
    
    return new Promise<boolean>((resolve) => {
      setResolveCallback(() => resolve)
    })
  }, [])

  const handleConfirm = useCallback(() => {
    setIsOpen(false)
    resolveCallback?.(true)
    setResolveCallback(null)
  }, [resolveCallback])

  const handleCancel = useCallback(() => {
    setIsOpen(false)
    resolveCallback?.(false)
    setResolveCallback(null)
  }, [resolveCallback])

  return {
    confirm,
    isOpen,
    options,
    handleConfirm,
    handleCancel,
  }
}
