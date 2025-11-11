import crypto from 'crypto'

export interface AdminUser {
  username: string
  passwordHash: string
  createdAt: string
  createdBy?: string
}

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
