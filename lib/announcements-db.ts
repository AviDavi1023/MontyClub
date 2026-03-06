import { createClient } from '@supabase/supabase-js'

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

/**
 * Get all announcements from the clubs table
 * Returns a Record<clubId, announcementText> for all clubs that have announcements
 */
export async function getAllAnnouncements(): Promise<Record<string, string>> {
  const client = getAdminClient()
  
  const { data, error } = await (client.from('clubs') as any)
    .select('id, announcement')
    .not('announcement', 'is', null)
    .neq('announcement', '')

  if (error) {
    console.error(`[DB ERROR] getAllAnnouncements query error:`, error)
    throw error
  }

  const announcements: Record<string, string> = {}
  
  if (data) {
    for (const row of data) {
      if (row.announcement) {
        announcements[row.id] = row.announcement
      }
    }
  }

  return announcements
}

/**
 * Set or update an announcement for a specific club
 * If announcement is empty string, it will be set to null (effectively clearing it)
 */
export async function setAnnouncement(clubId: string, announcement: string): Promise<void> {
  const client = getAdminClient()
  
  const textToSave = announcement && announcement.trim() ? announcement.trim() : null
  
  const updateData = {
    announcement: textToSave,
    updated_at: new Date().toISOString(),
  }
  
  const query = (client.from('clubs') as any)
    .update(updateData)
    .eq('id', clubId)
    .select('id, announcement')
  
  const { error, data, status } = await query

  if (error) {
    console.error(`[DB ERROR] setAnnouncement failed for ${clubId}:`, error)
    throw error
  }
  
  if (!data || data.length === 0) {
    return
  }
  
  const saved = data[0]
}

/**
 * Clear an announcement for a specific club
 */
export async function clearAnnouncement(clubId: string): Promise<void> {
  await setAnnouncement(clubId, '')
}

/**
 * Bulk clear announcements for multiple clubs
 */
export async function bulkClearAnnouncements(clubIds: string[]): Promise<number> {
  if (clubIds.length === 0) return 0

  const client = getAdminClient()
  
  const { data, error } = await (client.from('clubs') as any)
    .update({
      announcement: null,
      updated_at: new Date().toISOString(),
    })
    .in('id', clubIds)
    .select('id')

  if (error) throw error

  return data ? data.length : 0
}

/**
 * Get announcement for a specific club
 */
export async function getAnnouncement(clubId: string): Promise<string | null> {
  const client = getAdminClient()
  
  const { data, error } = await (client.from('clubs') as any)
    .select('announcement')
    .eq('id', clubId)
    .single()

  if (error && error.code !== 'PGRST116') throw error // 'PGRST116' is "no rows returned"
  
  return data?.announcement || null
}
