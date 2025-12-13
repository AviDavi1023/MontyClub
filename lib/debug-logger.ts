/**
 * Comprehensive debugging logger for diagnosing sync issues
 * Logs to console with timestamps and structured data
 */

interface LogEntry {
  timestamp: string
  epoch: number
  tag: string
  action: string
  details: Record<string, any>
}

const DEBUG_LOG_KEY = 'montyclub:debug-log'
const MAX_LOG_ENTRIES = 500

class DebugLogger {
  private logs: LogEntry[] = []

  /**
   * Log an event with full context
   */
  log(tag: string, action: string, details: Record<string, any> = {}) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      epoch: Date.now(),
      tag,
      action,
      details
    }

    this.logs.push(entry)
    if (this.logs.length > MAX_LOG_ENTRIES) {
      this.logs = this.logs.slice(-MAX_LOG_ENTRIES)
    }

    // Always log to console in a readable format
    console.log(
      `[${entry.timestamp}] ${tag}:${action}`,
      JSON.stringify(entry.details)
    )

    // Persist to localStorage
    try {
      localStorage.setItem(DEBUG_LOG_KEY, JSON.stringify(this.logs))
    } catch (e) {
      // Silently fail if localStorage is full
    }
  }

  /**
   * Get all logs as formatted text
   */
  getLogs(): string {
    return this.logs
      .map(
        (entry) =>
          `${entry.timestamp} [${entry.epoch}] ${entry.tag}:${entry.action} ${JSON.stringify(entry.details)}`
      )
      .join('\n')
  }

  /**
   * Get logs as JSON array
   */
  getLogsJSON(): LogEntry[] {
    return this.logs
  }

  /**
   * Clear all logs
   */
  clear() {
    this.logs = []
    localStorage.removeItem(DEBUG_LOG_KEY)
    console.log('Debug logs cleared')
  }

  /**
   * Print all logs to console nicely formatted
   */
  print() {
    console.group('=== DEBUG LOGS ===')
    console.log(this.getLogs())
    console.groupEnd()
  }

  /**
   * Copy logs to clipboard as JSON
   */
  copyToClipboard() {
    const logText = JSON.stringify(this.getLogsJSON(), null, 2)
    navigator.clipboard.writeText(logText).then(() => {
      console.log('Logs copied to clipboard!')
    })
  }

  /**
   * Load previously saved logs
   */
  loadFromStorage() {
    try {
      const saved = localStorage.getItem(DEBUG_LOG_KEY)
      if (saved) {
        this.logs = JSON.parse(saved)
        console.log(`Loaded ${this.logs.length} logs from storage`)
      }
    } catch (e) {
      console.error('Failed to load logs from storage', e)
    }
  }
}

export const debugLogger = new DebugLogger()

// Auto-load logs on initialization
if (typeof window !== 'undefined') {
  debugLogger.loadFromStorage()
}

// Make it globally accessible for console debugging
if (typeof window !== 'undefined') {
  (window as any).debugLogger = debugLogger
}
