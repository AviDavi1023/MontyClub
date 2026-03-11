import { createClient } from '@supabase/supabase-js'
import { RegistrationCollection } from '@/types/club'

// Lazy-initialize the admin client
let supabaseAdmin: ReturnType<typeof createClient> | null = null

function getAdminClient() {
  if (!supabaseAdmin) {
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase admin client not configured')
    }

    supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  }

  return supabaseAdmin
}

// Ensure collections migration happens on first call
let collectionsMigrationChecked = false
let collectionsDefaultsFixed = false // Flag to run one-time fix for migrated collections

async function ensureCollectionsMigrated(): Promise<void> {
  if (collectionsMigrationChecked) return

  collectionsMigrationChecked = true

  try {
    const client = getAdminClient()
    
    // Check if collections table has any rows
    const { count } = await client
      .from('registration_collections')
      .select('*', { count: 'exact', head: true })
    
    // If table has data, migration is complete
    if (count && count > 0) {
      console.log(`[collections-db] Using existing ${count} collections from Postgres`)
      return
    }

    console.log('[collections-db] Collections table is empty, attempting migration from Storage')

    // Try to read legacy collections from Storage
    const { data: fileData } = await client
      .storage
      .from('settings')
      .download('settings/registration-collections.json')

    if (!fileData) {
      console.log('[collections-db] No legacy collections found in Storage')
      return
    }

    const text = await fileData.text()
    const legacyCollections: RegistrationCollection[] = JSON.parse(text)

    if (!Array.isArray(legacyCollections) || legacyCollections.length === 0) {
      console.log('[collections-db] No valid legacy collections found')
      return
    }

    console.log(`[collections-db] Found ${legacyCollections.length} legacy collections, migrating...`)

    // Insert all collections into Postgres
    // IMPORTANT: For legacy collections, default enabled and accepting to true
    // to maintain backwards compatibility (old collections should work)
    for (const col of legacyCollections) {
      await (client.from('registration_collections') as any)
        .insert({
          id: col.id,
          name: col.name,
          enabled: col.enabled !== false, // Default to true for legacy collections
          display: col.display || false,
          accepting: col.accepting !== false, // Default to true for legacy collections
          renewal_enabled: col.renewalEnabled || false,
        })
    }

    console.log(`[collections-db] Successfully migrated ${legacyCollections.length} collections to Postgres`)
  } catch (error) {
    collectionsMigrationChecked = false
    console.error('[collections-db] Migration check failed:', error)
    throw error
  }
}

export async function listCollections(): Promise<RegistrationCollection[]> {
  await ensureCollectionsMigrated()
  
  const client = getAdminClient()
  const { data, error } = await (client.from('registration_collections') as any)
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data || []).map((row: any) => ({
    id: row.id,
    name: row.name,
    enabled: row.enabled,
    createdAt: row.created_at,
    display: row.display,
    accepting: row.accepting,
    renewalEnabled: row.renewal_enabled,
  }))
}

export async function getCollectionById(id: string): Promise<RegistrationCollection | null> {
  await ensureCollectionsMigrated()
  
  const client = getAdminClient()
  const { data, error } = await (client.from('registration_collections') as any)
    .select('*')
    .eq('id', id)
    .single()

  if (error && error.code !== 'PGRST116') throw error

  if (!data) return null

  return {
    id: data.id,
    name: data.name,
    enabled: data.enabled,
    createdAt: data.created_at,
    display: data.display,
    accepting: data.accepting,
    renewalEnabled: data.renewal_enabled,
  }
}

export async function getDisplayCollection(): Promise<RegistrationCollection | null> {
  await ensureCollectionsMigrated()
  
  const client = getAdminClient()
  const { data, error } = await (client.from('registration_collections') as any)
    .select('*')
    .eq('display', true)
    .single()

  if (error && error.code !== 'PGRST116') throw error

  if (!data) return null

  return {
    id: data.id,
    name: data.name,
    enabled: data.enabled,
    createdAt: data.created_at,
    display: data.display,
    accepting: data.accepting,
    renewalEnabled: data.renewal_enabled,
  }
}

export async function getAcceptingCollections(): Promise<RegistrationCollection[]> {
  await ensureCollectionsMigrated()
  
  const client = getAdminClient()
  const { data, error } = await (client.from('registration_collections') as any)
    .select('*')
    .eq('accepting', true)
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data || []).map((row: any) => ({
    id: row.id,
    name: row.name,
    enabled: row.enabled,
    createdAt: row.created_at,
    display: row.display,
    accepting: row.accepting,
    renewalEnabled: row.renewal_enabled,
  }))
}

export async function createCollection(col: RegistrationCollection): Promise<void> {
  await ensureCollectionsMigrated()
  
  const client = getAdminClient()
  const { error } = await (client.from('registration_collections') as any)
    .insert({
      id: col.id,
      name: col.name,
      enabled: col.enabled || false,
      display: col.display || false,
      accepting: col.accepting || false,
      renewal_enabled: col.renewalEnabled || false,
    })

  if (error) throw error
}

export async function updateCollection(id: string, updates: Partial<RegistrationCollection>): Promise<void> {
  await ensureCollectionsMigrated()
  
  const client = getAdminClient()
  
  const dbUpdates: Record<string, any> = {}
  if (updates.name !== undefined) dbUpdates.name = updates.name
  if (updates.enabled !== undefined) dbUpdates.enabled = updates.enabled
  if (updates.display !== undefined) dbUpdates.display = updates.display
  if (updates.accepting !== undefined) dbUpdates.accepting = updates.accepting
  if (updates.renewalEnabled !== undefined) dbUpdates.renewal_enabled = updates.renewalEnabled

  dbUpdates.updated_at = new Date().toISOString()

  const { error } = await (client.from('registration_collections') as any)
    .update(dbUpdates)
    .eq('id', id)

  if (error) throw error
}

export async function deleteCollection(id: string): Promise<void> {
  await ensureCollectionsMigrated()
  
  const client = getAdminClient()
  const { error } = await (client.from('registration_collections') as any)
    .delete()
    .eq('id', id)

  if (error) throw error
}

export async function deleteAllCollections(): Promise<void> {
  await ensureCollectionsMigrated()
  
  const client = getAdminClient()
  const { error } = await (client.from('registration_collections') as any)
    .delete()
    .neq('id', '')

  if (error) throw error
}

/**
 * Ensure only one collection has display=true
 * Sets all others to display=false
 */
export async function ensureSingleDisplay(displayCollectionId: string): Promise<void> {
  await ensureCollectionsMigrated()
  
  const client = getAdminClient()
  
  // Set all to display=false
  await (client.from('registration_collections') as any)
    .update({ display: false, updated_at: new Date().toISOString() })
    .neq('id', '')

  // Set the specified one to display=true
  const { error } = await (client.from('registration_collections') as any)
    .update({ display: true, updated_at: new Date().toISOString() })
    .eq('id', displayCollectionId)

  if (error) throw error
}
