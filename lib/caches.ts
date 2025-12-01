import { ApiCache } from './api-cache'

// Central cache instances per domain. Extend as needed in later stages.
export const updatesCache = new ApiCache<any[]>('updates-cache')
export const announcementsCache = new ApiCache<Record<string, string>>('announcements-cache')
export const registrationsCache = new ApiCache<any[]>('registrations-cache')
export const usersCache = new ApiCache<any[]>('users-cache')

// Cache for individual registration actions (approve/deny/delete)
// Maps registration path to { status, denialReason?, timestamp }
export const registrationActionsCache = new ApiCache<Record<string, any>>('registration-actions-cache')
