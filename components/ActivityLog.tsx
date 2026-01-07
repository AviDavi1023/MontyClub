'use client'

import { useState, useEffect } from 'react'
import { RefreshCw, CheckCircle, XCircle, AlertCircle, Trash2 } from 'lucide-react'

export interface ActivityLogEntry {
  id: string
  timestamp: string
  type: 'registration' | 'announcement' | 'collection' | 'user' | 'settings' | 'import' | 'system'
  action: string
  details: string
  status: 'success' | 'error' | 'warning' | 'info'
  user?: string
}

const ACTIVITY_LOG_KEY = 'montyclub:activityLog'
const MAX_LOG_ENTRIES = 100

export function logActivity(entry: Omit<ActivityLogEntry, 'id' | 'timestamp'>) {
  try {
    const logs = getActivityLogs()
    const newEntry: ActivityLogEntry = {
      ...entry,
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
    }
    
    logs.unshift(newEntry)
    
    // Keep only the most recent entries
    const trimmedLogs = logs.slice(0, MAX_LOG_ENTRIES)
    localStorage.setItem(ACTIVITY_LOG_KEY, JSON.stringify(trimmedLogs))
    
    // Dispatch event for live updates
    window.dispatchEvent(new CustomEvent('activity-log-updated'))
  } catch (error) {
    console.error('Failed to log activity:', error)
  }
}

export function getActivityLogs(): ActivityLogEntry[] {
  try {
    const stored = localStorage.getItem(ACTIVITY_LOG_KEY)
    if (!stored) return []
    return JSON.parse(stored)
  } catch {
    return []
  }
}

export function clearActivityLogs() {
  try {
    localStorage.removeItem(ACTIVITY_LOG_KEY)
    window.dispatchEvent(new CustomEvent('activity-log-updated'))
  } catch (error) {
    console.error('Failed to clear activity log:', error)
  }
}

export function ActivityLog() {
  const [logs, setLogs] = useState<ActivityLogEntry[]>([])
  const [filter, setFilter] = useState<string>('all')

  const loadLogs = () => {
    setLogs(getActivityLogs())
  }

  useEffect(() => {
    loadLogs()
    
    const handleUpdate = () => loadLogs()
    window.addEventListener('activity-log-updated', handleUpdate)
    
    return () => {
      window.removeEventListener('activity-log-updated', handleUpdate)
    }
  }, [])

  const filteredLogs = filter === 'all' 
    ? logs 
    : logs.filter(log => log.type === filter)

  const getStatusIcon = (status: ActivityLogEntry['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />
      default:
        return <AlertCircle className="h-5 w-5 text-blue-500" />
    }
  }

  const getTypeColor = (type: ActivityLogEntry['type']) => {
    const colors = {
      registration: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      announcement: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
      collection: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      user: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
      settings: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
      import: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
      system: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400',
    }
    return colors[type] || colors.system
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString()
  }

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Activity Log</h2>
        <div className="flex gap-2">
          <button
            onClick={loadLogs}
            className="btn-secondary text-sm flex items-center gap-2"
            title="Refresh log"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            onClick={() => {
              if (confirm('Clear all activity logs? This cannot be undone.')) {
                clearActivityLogs()
              }
            }}
            className="btn-secondary text-sm flex items-center gap-2"
            title="Clear log"
          >
            <Trash2 className="h-4 w-4" />
            Clear
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="mb-6 flex gap-2 flex-wrap">
        {['all', 'registration', 'announcement', 'collection', 'user', 'settings', 'import', 'system'].map((filterType) => (
          <button
            key={filterType}
            onClick={() => setFilter(filterType)}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${
              filter === filterType
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {filterType.charAt(0).toUpperCase() + filterType.slice(1)}
          </button>
        ))}
      </div>

      {/* Log entries */}
      <div className="space-y-2 max-h-[600px] overflow-y-auto">
        {filteredLogs.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No activity logs yet</p>
            <p className="text-sm mt-1">Actions will be tracked here automatically</p>
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div
              key={log.id}
              className="flex gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
            >
              <div className="flex-shrink-0 mt-0.5">
                {getStatusIcon(log.status)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 text-xs font-medium rounded ${getTypeColor(log.type)}`}>
                    {log.type}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {formatTimestamp(log.timestamp)}
                  </span>
                  {log.user && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      by {log.user}
                    </span>
                  )}
                </div>
                <div className="text-sm font-medium text-gray-900 dark:text-white mb-0.5">
                  {log.action}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  {log.details}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
