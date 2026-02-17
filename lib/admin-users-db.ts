import { createClient } from '@supabase/supabase-js'
import { AdminUser } from '@/lib/auth'
import { readData } from '@/lib/runtime-store'

type AdminUserRow = {
  username: string
  password_hash: string
  email: string | null
  is_primary: boolean | null
  created_at: string
  created_by: string | null
  last_password_change: string | null
}

let adminClient: ReturnType<typeof createClient> | null = null

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase()
}

function getAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase admin client not configured')
  }
  if (!adminClient) {
    adminClient = createClient(supabaseUrl, supabaseServiceKey)
  }
  return adminClient
}

function adminUsersTable(client: ReturnType<typeof createClient>) {
  return client.from('admin_users') as any
}

function rowToAdminUser(row: AdminUserRow): AdminUser {
  return {
    username: row.username,
    passwordHash: row.password_hash,
    email: row.email ?? undefined,
    isPrimary: row.is_primary ?? false,
    createdAt: row.created_at,
    createdBy: row.created_by ?? undefined,
    lastPasswordChange: row.last_password_change ?? undefined,
  }
}

function userToRow(user: AdminUser, fallbackUsername?: string): AdminUserRow {
  const username = normalizeUsername(user.username || fallbackUsername || '')
  return {
    username,
    password_hash: user.passwordHash,
    email: user.email ?? null,
    is_primary: user.isPrimary ?? false,
    created_at: user.createdAt || new Date().toISOString(),
    created_by: user.createdBy ?? null,
    last_password_change: user.lastPasswordChange ?? null,
  }
}

async function ensureAdminUsersMigrated(): Promise<void> {
  const client = getAdminClient()
  const { count, error } = await adminUsersTable(client)
    .select('username', { count: 'exact', head: true })

  if (error) {
    throw error
  }

  if (count && count > 0) {
    return
  }

  const runtimeUsers: Record<string, AdminUser> = await readData('admin-users', {})
  const entries = Object.entries(runtimeUsers)
  if (entries.length === 0) {
    return
  }

  let hasPrimary = false
  for (const [, user] of entries) {
    if (user?.isPrimary) {
      hasPrimary = true
      break
    }
  }

  if (!hasPrimary) {
    const [firstKey, firstUser] = entries[0]
    entries[0] = [firstKey, { ...firstUser, isPrimary: true }]
  }

  const rows = entries.map(([key, user]) => userToRow(user, key))
  const { error: insertError } = await adminUsersTable(client)
    .upsert(rows, { onConflict: 'username' })

  if (insertError) {
    throw insertError
  }
}

export async function listAdminUsers(): Promise<AdminUser[]> {
  await ensureAdminUsersMigrated()
  const client = getAdminClient()
  const { data, error } = await adminUsersTable(client)
    .select('*')
    .order('created_at', { ascending: true })

  if (error) {
    throw error
  }

  return (data || []).map(rowToAdminUser)
}

export async function countAdminUsers(): Promise<number> {
  await ensureAdminUsersMigrated()
  const client = getAdminClient()
  const { count, error } = await adminUsersTable(client)
    .select('username', { count: 'exact', head: true })

  if (error) {
    throw error
  }

  return count || 0
}

export async function getAdminUserByUsername(username: string): Promise<AdminUser | null> {
  await ensureAdminUsersMigrated()
  const client = getAdminClient()
  const normalized = normalizeUsername(username)
  const { data, error } = await adminUsersTable(client)
    .select('*')
    .eq('username', normalized)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data ? rowToAdminUser(data as AdminUserRow) : null
}

export async function getPrimaryAdmin(): Promise<AdminUser | null> {
  await ensureAdminUsersMigrated()
  const client = getAdminClient()
  const { data, error } = await adminUsersTable(client)
    .select('*')
    .eq('is_primary', true)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data ? rowToAdminUser(data as AdminUserRow) : null
}

export async function createAdminUser(user: AdminUser): Promise<void> {
  const client = getAdminClient()
  const row = userToRow(user)
  const { error } = await adminUsersTable(client).insert(row)
  if (error) {
    throw error
  }
}

export async function updateAdminUser(username: string, updates: Partial<AdminUser>): Promise<void> {
  const client = getAdminClient()
  const normalized = normalizeUsername(username)
  const payload: Partial<AdminUserRow> = {}

  if (typeof updates.passwordHash === 'string') {
    payload.password_hash = updates.passwordHash
  }
  if (updates.email !== undefined) {
    payload.email = updates.email ?? null
  }
  if (typeof updates.isPrimary === 'boolean') {
    payload.is_primary = updates.isPrimary
  }
  if (typeof updates.createdAt === 'string') {
    payload.created_at = updates.createdAt
  }
  if (updates.createdBy !== undefined) {
    payload.created_by = updates.createdBy ?? null
  }
  if (typeof updates.lastPasswordChange === 'string') {
    payload.last_password_change = updates.lastPasswordChange
  }

  if (Object.keys(payload).length === 0) {
    return
  }

  const { error } = await adminUsersTable(client)
    .update(payload)
    .eq('username', normalized)

  if (error) {
    throw error
  }
}

export async function deleteAdminUser(username: string): Promise<void> {
  const client = getAdminClient()
  const normalized = normalizeUsername(username)
  const { error } = await adminUsersTable(client).delete().eq('username', normalized)
  if (error) {
    throw error
  }
}

export async function deleteAllAdminUsers(): Promise<void> {
  const client = getAdminClient()
  const { error } = await adminUsersTable(client).delete().neq('username', '')
  if (error) {
    throw error
  }
}

export async function setPrimaryAdmin(username: string): Promise<void> {
  const client = getAdminClient()
  const normalized = normalizeUsername(username)

  const { error: clearError } = await adminUsersTable(client)
    .update({ is_primary: false })
    .neq('username', normalized)

  if (clearError) {
    throw clearError
  }

  const { error: setError } = await adminUsersTable(client)
    .update({ is_primary: true })
    .eq('username', normalized)

  if (setError) {
    throw setError
  }
}
