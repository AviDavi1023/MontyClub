import { useState, useCallback } from 'react'
import { Toast, ToastType } from '@/components/Toast'

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now().toString()
    const newToast: Toast = { id, message, type }
    
    setToasts(prev => [...prev, newToast])
    return id
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }, [])

  const showSuccess = useCallback((message: string) => {
    return addToast(message, 'success')
  }, [addToast])

  const showError = useCallback((message: string) => {
    return addToast(message, 'error')
  }, [addToast])

  const showInfo = useCallback((message: string) => {
    return addToast(message, 'info')
  }, [addToast])

  return {
    toasts,
    addToast,
    removeToast,
    showSuccess,
    showError,
    showInfo,
  }
}
