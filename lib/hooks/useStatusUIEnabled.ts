import { useEffect, useState } from 'react'

const STATUS_UI_KEY = 'settings:statusUIEnabled'

function readStatusFromStorage(): boolean | null {
  if (typeof window === 'undefined') return null
  try {
    const value = localStorage.getItem(STATUS_UI_KEY)
    if (value === 'true') return true
    if (value === 'false') return false
  } catch {}
  return null
}

export function useStatusUIEnabled(initialValue: boolean = true): boolean {
  const [enabled, setEnabled] = useState<boolean>(() => {
    const storageValue = readStatusFromStorage()
    return storageValue ?? initialValue
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    let isMounted = true

    const syncFromStorage = () => {
      const storageValue = readStatusFromStorage()
      if (storageValue !== null) {
        setEnabled(storageValue)
      }
    }

    const onStorage = (e: StorageEvent) => {
      if (e.key !== STATUS_UI_KEY) return
      if (typeof e.newValue === 'string') {
        setEnabled(e.newValue === 'true')
      }
    }

    const onSettingsUpdated = (event: Event) => {
      const custom = event as CustomEvent<{ statusUIEnabled?: boolean }>
      if (typeof custom.detail?.statusUIEnabled === 'boolean') {
        setEnabled(custom.detail.statusUIEnabled)
        return
      }
      syncFromStorage()
    }

    window.addEventListener('storage', onStorage)
    window.addEventListener('settings-updated', onSettingsUpdated)

    // Respect server truth on mount while keeping localStorage in sync for instant first render.
    fetch('/api/settings', { cache: 'no-store' })
      .then(async (resp) => {
        if (!resp.ok || !isMounted) return
        const settings = await resp.json()
        const nextEnabled = settings.statusUIEnabled !== false
        setEnabled(nextEnabled)
        try {
          localStorage.setItem(STATUS_UI_KEY, String(nextEnabled))
        } catch {}
      })
      .catch(() => {})

    return () => {
      isMounted = false
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('settings-updated', onSettingsUpdated)
    }
  }, [])

  return enabled
}
