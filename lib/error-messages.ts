/**
 * User-friendly error messages for common errors
 */

export const errorMessages: Record<string, string> = {
  // Network errors
  'NETWORK_ERROR': "Can't reach the server. Please check your internet connection and try again.",
  'TIMEOUT': "Request took too long. Please try again.",
  'OFFLINE': "You're offline. Please check your connection.",
  
  // Server errors
  'SERVER_ERROR': "Server error. Please try again in a few moments.",
  'SERVICE_UNAVAILABLE': "Service temporarily unavailable. Please try again later.",
  '500': "Server error. Our team has been notified.",
  '502': "Server is temporarily down. Please try again in a moment.",
  '503': "Service is temporarily unavailable. Please try again later.",
  
  // Auth errors
  'AUTH_FAILED': "Authentication failed. Please log in again.",
  'UNAUTHORIZED': "You don't have permission to do that.",
  'FORBIDDEN': "Access denied. Please contact an administrator.",
  '401': "Session expired. Please log in again.",
  '403': "You don't have permission to access this resource.",
  
  // Validation errors
  'VALIDATION_ERROR': "Please check the highlighted fields and try again.",
  'REQUIRED_FIELD': "This field is required.",
  'INVALID_EMAIL': "Please enter a valid email address.",
  'INVALID_FORMAT': "Invalid format. Please check your input.",
  
  // Data errors
  'NOT_FOUND': "The requested item could not be found.",
  'CONFLICT': "This item was modified by someone else. Please reload and try again.",
  'DUPLICATE': "This item already exists.",
  '404': "Item not found.",
  '409': "Conflict detected. Please reload and try again.",
  
  // Generic
  'UNKNOWN': "Something went wrong. Please try again.",
}

/**
 * Get a user-friendly error message from an error object
 */
export function getUserFriendlyError(error: any): string {
  // If it's already a string, return it
  if (typeof error === 'string') {
    return errorMessages[error] || error
  }
  
  // If it's an Error object
  if (error instanceof Error) {
    // Check if the message matches a known error code
    const upperMessage = error.message.toUpperCase()
    for (const [code, message] of Object.entries(errorMessages)) {
      if (upperMessage.includes(code)) {
        return message
      }
    }
    return error.message
  }
  
  // If it's an HTTP response
  if (error?.status) {
    const statusCode = error.status.toString()
    return errorMessages[statusCode] || errorMessages['UNKNOWN']
  }
  
  // If it's a fetch error
  if (error?.name === 'TypeError' && error?.message?.includes('fetch')) {
    return errorMessages['NETWORK_ERROR']
  }
  
  // If it's a timeout error
  if (error?.name === 'AbortError') {
    return errorMessages['TIMEOUT']
  }
  
  return errorMessages['UNKNOWN']
}

/**
 * Format error for display in toast notification
 */
export function formatErrorForToast(error: any): { message: string; action?: string } {
  const message = getUserFriendlyError(error)
  
  // Determine if we should show a retry action
  const shouldRetry = 
    message.includes('server') ||
    message.includes('connection') ||
    message.includes('temporarily')
  
  return {
    message,
    action: shouldRetry ? 'Retry' : undefined
  }
}
