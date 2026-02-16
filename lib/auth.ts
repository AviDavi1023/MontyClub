import crypto from 'crypto'

export interface AdminUser {
  username: string
  passwordHash: string
  email?: string // Email for password reset notifications (required for primary admin)
  isPrimary?: boolean // Primary admin who receives password reset requests
  createdAt: string
  createdBy?: string
  resetToken?: string // One-time password reset token
  resetTokenExpiry?: string // When reset token expires
  lastPasswordChange?: string // Timestamp of last password change
}

export interface PasswordResetToken {
  token: string
  username: string
  expiresAt: string
  used: boolean
  usedAt?: string
}

// Store reset tokens in memory (in production, use database)
const passwordResetTokens = new Map<string, PasswordResetToken>()

/**
 * Hash a password using PBKDF2 with a random salt
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex')
  return `${salt}:${hash}`
}

/**
 * Verify a password against a stored hash
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, hash] = storedHash.split(':')
    if (!salt || !hash) return false
    const verifyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex')
    return hash === verifyHash
  } catch (e) {
    return false
  }
}

/**
 * Generate a secure random password
 */
export function generatePassword(length: number = 12): string {
  const chars = 'ABCDEFGHIJKLMNPQRSTUVWXYZabcdefghijklmnpqrstuvwxyz23456789!@#$%^&*'
  let password = ''
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

/**
 * Generate a secure password reset token (base64 URL-safe)
 */
export function generateResetToken(): string {
  // 32 bytes = 256 bits of entropy
  const token = crypto.randomBytes(32).toString('base64url')
  return token
}

/**
 * Create a password reset token for a user
 * @param username Username requesting password reset
 * @param expiryMinutes How long the token is valid (default 15 minutes)
 * @returns The reset token
 */
export function createPasswordResetToken(username: string, expiryMinutes: number = 15): string {
  const token = generateResetToken()
  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000).toISOString()

  passwordResetTokens.set(token, {
    token,
    username,
    expiresAt,
    used: false,
  })

  // Clean up expired tokens periodically
  cleanupExpiredResetTokens()

  return token
}

/**
 * Verify a password reset token
 * @returns Username if valid, null if invalid/expired/used
 */
export function verifyResetToken(token: string): string | null {
  const record = passwordResetTokens.get(token)

  if (!record) {
    console.warn(`[Auth] Reset token not found: ${token.substring(0, 8)}...`)
    return null
  }

  if (record.used) {
    console.warn(`[Auth] Reset token already used: ${record.username}`)
    return null
  }

  if (new Date() > new Date(record.expiresAt)) {
    console.warn(`[Auth] Reset token expired: ${record.username}`)
    passwordResetTokens.delete(token)
    return null
  }

  return record.username
}

/**
 * Mark a reset token as used
 */
export function markResetTokenAsUsed(token: string): boolean {
  const record = passwordResetTokens.get(token)
  if (!record) return false

  record.used = true
  record.usedAt = new Date().toISOString()
  return true
}

/**
 * Clean up expired reset tokens
 * Call periodically to prevent memory bloat
 */
export function cleanupExpiredResetTokens(): number {
  let cleaned = 0
  const now = new Date()

  for (const [token, record] of passwordResetTokens.entries()) {
    if (now > new Date(record.expiresAt) || (record.used && record.usedAt && new Date(record.usedAt) < new Date(Date.now() - 24 * 60 * 60 * 1000))) {
      passwordResetTokens.delete(token)
      cleaned++
    }
  }

  if (cleaned > 0) {
    console.log(`[Auth] Cleaned up ${cleaned} expired reset tokens`)
  }

  return cleaned
}

/**
 * Get reset token stats (for monitoring)
 */
export function getResetTokenStats() {
  let activeCount = 0
  let usedCount = 0

  for (const record of passwordResetTokens.values()) {
    if (record.used) {
      usedCount++
    } else if (new Date() <= new Date(record.expiresAt)) {
      activeCount++
    }
  }

  return {
    active: activeCount,
    used: usedCount,
    total: passwordResetTokens.size,
  }
}

/**
 * Invalidate all reset tokens for a user
 * (call when password is successfully reset or user changes password)
 */
export function invalidateUserResetTokens(username: string): number {
  let invalidated = 0

  for (const [token, record] of passwordResetTokens.entries()) {
    if (record.username === username && !record.used) {
      passwordResetTokens.delete(token)
      invalidated++
    }
  }

  if (invalidated > 0) {
    console.log(`[Auth] Invalidated ${invalidated} reset tokens for user: ${username}`)
  }

  return invalidated
}

