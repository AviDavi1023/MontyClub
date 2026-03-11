import { createClient } from '@supabase/supabase-js'
import { Club } from '@/types/club'

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

// Ensure clubs migration happens on first call
let clubsMigrationChecked = false

async function ensureClubsMigrated(): Promise<void> {
  if (clubsMigrationChecked) return

  clubsMigrationChecked = true

  try {
    const client = getAdminClient()
    
    // Check if clubs table has any rows
    const { count } = await client
      .from('clubs')
      .select('*', { count: 'exact', head: true })
    
    // If table has data, migration is complete
    if (count && count > 0) {
      console.log(`[clubs-db] Using existing ${count} clubs from Postgres`)
      return
    }

    console.log('[clubs-db] Clubs table is empty, attempting migration from Storage')

    // Try to migrate from old Storage format
    const { data: existingClubs } = await client
      .storage
      .from('clubs')
      .list('clubs', { limit: 1000 })

    if (!existingClubs || existingClubs.length === 0) {
      console.log('[clubs-db] No legacy clubs found in Storage')
      return
    }

    console.log(`[clubs-db] Found ${existingClubs.length} legacy club files in Storage, reading now...`)

    // Read all club JSON files from Storage
    const clubFiles = existingClubs.filter(f => f.name.endsWith('.json'))
    const migratedClubs: Club[] = []

    for (const file of clubFiles) {
      try {
        const { data: fileData } = await client
          .storage
          .from('clubs')
          .download(`clubs/${file.name}`)

        if (fileData) {
          const text = await fileData.text()
          const club: Club = JSON.parse(text)
          migratedClubs.push(club)
        }
      } catch (e) {
        console.warn(`[clubs-db] Failed to migrate club file ${file.name}:`, e)
      }
    }

    if (migratedClubs.length === 0) {
      console.log('[clubs-db] No valid clubs found to migrate')
      return
    }

    // Insert all clubs into Postgres
    for (const club of migratedClubs) {
      await (client.from('clubs') as any)
        .insert({
          id: club.id,
          name: club.name,
          category: club.category,
          description: club.description,
          advisor: club.advisor,
          student_leader: club.studentLeader,
          meeting_time: club.meetingTime,
          meeting_frequency: club.meetingFrequency || null,
          location: club.location,
          contact: club.contact,
          social_media: club.socialMedia,
          active: club.active,
          notes: club.notes || null,
          announcement: club.announcement || null,
          keywords: club.keywords || [],
        })
    }

    console.log(`[clubs-db] Successfully migrated ${migratedClubs.length} clubs to Postgres`)
  } catch (error) {
    clubsMigrationChecked = false
    console.error('[clubs-db] Migration check failed:', error)
    throw error
  }
}

export async function listClubs(): Promise<Club[]> {
  await ensureClubsMigrated()
  
  const client = getAdminClient()
  const { data, error } = await (client.from('clubs') as any)
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data || []).map((row: any) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description,
    advisor: row.advisor,
    studentLeader: row.student_leader,
    meetingTime: row.meeting_time,
    meetingFrequency: row.meeting_frequency,
    location: row.location,
    contact: row.contact,
    socialMedia: row.social_media,
    active: row.active,
    notes: row.notes,
    announcement: row.announcement,
    keywords: row.keywords || [],
  }))
}

export async function getClubById(id: string): Promise<Club | null> {
  await ensureClubsMigrated()
  
  const client = getAdminClient()
  const { data, error } = await (client.from('clubs') as any)
    .select('*')
    .eq('id', id)
    .single()

  if (error && error.code !== 'PGRST116') throw error // 'PGRST116' is "no rows returned"
  
  if (!data) return null

  return {
    id: data.id,
    name: data.name,
    category: data.category,
    description: data.description,
    advisor: data.advisor,
    studentLeader: data.student_leader,
    meetingTime: data.meeting_time,
    meetingFrequency: data.meeting_frequency,
    location: data.location,
    contact: data.contact,
    socialMedia: data.social_media,
    active: data.active,
    notes: data.notes,
    announcement: data.announcement,
    keywords: data.keywords || [],
  }
}

export async function createClub(club: Club): Promise<void> {
  await ensureClubsMigrated()
  
  const client = getAdminClient()
  const { error } = await (client.from('clubs') as any)
    .insert({
      id: club.id,
      name: club.name,
      category: club.category,
      description: club.description,
      advisor: club.advisor,
      student_leader: club.studentLeader,
      meeting_time: club.meetingTime,
      meeting_frequency: club.meetingFrequency || null,
      location: club.location,
      contact: club.contact,
      social_media: club.socialMedia,
      active: club.active,
      notes: club.notes || null,
      announcement: club.announcement || null,
      keywords: club.keywords || [],
    })

  if (error) throw error
}

export async function updateClub(id: string, updates: Partial<Club>): Promise<void> {
  await ensureClubsMigrated()
  
  const client = getAdminClient()
  
  const dbUpdates: Record<string, any> = {}
  if (updates.name !== undefined) dbUpdates.name = updates.name
  if (updates.category !== undefined) dbUpdates.category = updates.category
  if (updates.description !== undefined) dbUpdates.description = updates.description
  if (updates.advisor !== undefined) dbUpdates.advisor = updates.advisor
  if (updates.studentLeader !== undefined) dbUpdates.student_leader = updates.studentLeader
  if (updates.meetingTime !== undefined) dbUpdates.meeting_time = updates.meetingTime
  if (updates.meetingFrequency !== undefined) dbUpdates.meeting_frequency = updates.meetingFrequency
  if (updates.location !== undefined) dbUpdates.location = updates.location
  if (updates.contact !== undefined) dbUpdates.contact = updates.contact
  if (updates.socialMedia !== undefined) dbUpdates.social_media = updates.socialMedia
  if (updates.active !== undefined) dbUpdates.active = updates.active
  if (updates.notes !== undefined) dbUpdates.notes = updates.notes
  if (updates.announcement !== undefined) dbUpdates.announcement = updates.announcement
  if (updates.keywords !== undefined) dbUpdates.keywords = updates.keywords
  
  dbUpdates.updated_at = new Date().toISOString()

  const { error } = await (client.from('clubs') as any)
    .update(dbUpdates)
    .eq('id', id)

  if (error) throw error
}

export async function deleteClub(id: string): Promise<void> {
  await ensureClubsMigrated()
  
  const client = getAdminClient()
  const { error } = await (client.from('clubs') as any)
    .delete()
    .eq('id', id)

  if (error) throw error
}

export async function deleteAllClubs(): Promise<void> {
  await ensureClubsMigrated()
  
  const client = getAdminClient()
  const { error } = await (client.from('clubs') as any)
    .delete()
    .neq('id', '')

  if (error) throw error
}
