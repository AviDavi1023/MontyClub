import { createClient } from '@supabase/supabase-js'
import { ClubRegistration } from '@/types/club'

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

// Ensure registrations migration happens on first call
let registrationsMigrationChecked = false

async function ensureRegistrationsMigrated(): Promise<void> {
  if (registrationsMigrationChecked) return

  registrationsMigrationChecked = true

  try {
    const client = getAdminClient()
    
    // Check if registrations table has any rows
    const { count } = await client
      .from('club_registrations')
      .select('*', { count: 'exact', head: true })
    
    // If table has data, migration is complete
    if (count && count > 0) {
      console.log(`[registrations-db] Using existing ${count} registrations from Postgres`)
      return
    }

    console.log('[registrations-db] Registrations table is empty, attempting migration from Storage')

    // List all collection directories in Storage
    const { data: collections } = await client
      .storage
      .from('registrations')
      .list('registrations', { limit: 1000 })

    if (!collections || collections.length === 0) {
      console.log('[registrations-db] No legacy registrations found in Storage')
      return
    }

    console.log(`[registrations-db] Found ${collections.length} collection directories, reading registrations...`)

    const migratedRegs: ClubRegistration[] = []

    // Read all registrations from each collection
    for (const item of collections) {
      if (!item.id) continue

      try {
        const { data: files } = await client
          .storage
          .from('registrations')
          .list(`registrations/${item.id}`, { limit: 1000 })

        if (!files) continue

        for (const file of files) {
          if (!file.name.endsWith('.json')) continue

          try {
            const { data: fileData } = await client
              .storage
              .from('registrations')
              .download(`registrations/${item.id}/${file.name}`)

            if (fileData) {
              const text = await fileData.text()
              const reg: ClubRegistration = JSON.parse(text)
              migratedRegs.push(reg)
            }
          } catch (e) {
            console.warn(`[registrations-db] Failed to read file ${item.id}/${file.name}:`, e)
          }
        }
      } catch (e) {
        console.warn(`[registrations-db] Failed to list collection ${item.id}:`, e)
      }
    }

    if (migratedRegs.length === 0) {
      console.log('[registrations-db] No valid registrations found to migrate')
      return
    }

    // Insert all registrations into Postgres
    for (const reg of migratedRegs) {
      await (client.from('club_registrations') as any)
        .insert({
          id: reg.id,
          email: reg.email,
          club_name: reg.clubName,
          advisor_name: reg.advisorName,
          statement_of_purpose: reg.statementOfPurpose,
          location: reg.location,
          meeting_day: reg.meetingDay,
          meeting_frequency: reg.meetingFrequency,
          student_contact_name: reg.studentContactName,
          student_contact_email: reg.studentContactEmail,
          advisor_agreement_date: reg.advisorAgreementDate,
          club_agreement_date: reg.clubAgreementDate,
          submitted_at: reg.submittedAt,
          status: reg.status,
          collection_id: reg.collectionId,
          denial_reason: reg.denialReason || null,
          approved_at: reg.approvedAt || null,
          social_media: reg.socialMedia || null,
          category: reg.category,
          notes: reg.notes || null,
          renewed_from_id: reg.renewedFromId || null,
        })
    }

    console.log(`[registrations-db] Successfully migrated ${migratedRegs.length} registrations to Postgres`)
  } catch (error) {
    console.error('[registrations-db] Migration check failed:', error)
    throw error
  }
}

export async function listRegistrations(
  filters?: { collectionId?: string; status?: string; email?: string }
): Promise<ClubRegistration[]> {
  await ensureRegistrationsMigrated()
  
  const client = getAdminClient()
  let query = (client.from('club_registrations') as any)
    .select('*')

  if (filters?.collectionId) {
    query = query.eq('collection_id', filters.collectionId)
  }
  if (filters?.status) {
    query = query.eq('status', filters.status)
  }
  if (filters?.email) {
    query = query.eq('email', filters.email)
  }

  const { data, error } = await query
    .order('submitted_at', { ascending: false })

  if (error) throw error

  return (data || []).map((row: any) => ({
    id: row.id,
    email: row.email,
    clubName: row.club_name,
    advisorName: row.advisor_name,
    statementOfPurpose: row.statement_of_purpose,
    location: row.location,
    meetingDay: row.meeting_day,
    meetingFrequency: row.meeting_frequency,
    studentContactName: row.student_contact_name,
    studentContactEmail: row.student_contact_email,
    advisorAgreementDate: row.advisor_agreement_date,
    clubAgreementDate: row.club_agreement_date,
    submittedAt: row.submitted_at,
    status: row.status,
    collectionId: row.collection_id,
    denialReason: row.denial_reason,
    approvedAt: row.approved_at,
    socialMedia: row.social_media,
    category: row.category,
    notes: row.notes,
    renewedFromId: row.renewed_from_id,
  }))
}

export async function getRegistrationById(id: string): Promise<ClubRegistration | null> {
  await ensureRegistrationsMigrated()
  
  const client = getAdminClient()
  const { data, error } = await (client.from('club_registrations') as any)
    .select('*')
    .eq('id', id)
    .single()

  if (error && error.code !== 'PGRST116') throw error

  if (!data) return null

  return {
    id: data.id,
    email: data.email,
    clubName: data.club_name,
    advisorName: data.advisor_name,
    statementOfPurpose: data.statement_of_purpose,
    location: data.location,
    meetingDay: data.meeting_day,
    meetingFrequency: data.meeting_frequency,
    studentContactName: data.student_contact_name,
    studentContactEmail: data.student_contact_email,
    advisorAgreementDate: data.advisor_agreement_date,
    clubAgreementDate: data.club_agreement_date,
    submittedAt: data.submitted_at,
    status: data.status,
    collectionId: data.collection_id,
    denialReason: data.denial_reason,
    approvedAt: data.approved_at,
    socialMedia: data.social_media,
    category: data.category,
    notes: data.notes,
    renewedFromId: data.renewed_from_id,
  }
}

export async function createRegistration(reg: ClubRegistration): Promise<void> {
  await ensureRegistrationsMigrated()
  
  const client = getAdminClient()
  const { error } = await (client.from('club_registrations') as any)
    .insert({
      id: reg.id,
      email: reg.email,
      club_name: reg.clubName,
      advisor_name: reg.advisorName,
      statement_of_purpose: reg.statementOfPurpose,
      location: reg.location,
      meeting_day: reg.meetingDay,
      meeting_frequency: reg.meetingFrequency,
      student_contact_name: reg.studentContactName,
      student_contact_email: reg.studentContactEmail,
      advisor_agreement_date: reg.advisorAgreementDate,
      club_agreement_date: reg.clubAgreementDate,
      submitted_at: reg.submittedAt,
      status: reg.status,
      collection_id: reg.collectionId,
      denial_reason: reg.denialReason || null,
      approved_at: reg.approvedAt || null,
      social_media: reg.socialMedia || null,
      category: reg.category,
      notes: reg.notes || null,
      renewed_from_id: reg.renewedFromId || null,
    })

  if (error) throw error
}

export async function updateRegistration(id: string, updates: Partial<ClubRegistration>): Promise<void> {
  await ensureRegistrationsMigrated()
  
  const client = getAdminClient()
  
  const dbUpdates: Record<string, any> = {}
  if (updates.email !== undefined) dbUpdates.email = updates.email
  if (updates.clubName !== undefined) dbUpdates.club_name = updates.clubName
  if (updates.advisorName !== undefined) dbUpdates.advisor_name = updates.advisorName
  if (updates.statementOfPurpose !== undefined) dbUpdates.statement_of_purpose = updates.statementOfPurpose
  if (updates.location !== undefined) dbUpdates.location = updates.location
  if (updates.meetingDay !== undefined) dbUpdates.meeting_day = updates.meetingDay
  if (updates.meetingFrequency !== undefined) dbUpdates.meeting_frequency = updates.meetingFrequency
  if (updates.studentContactName !== undefined) dbUpdates.student_contact_name = updates.studentContactName
  if (updates.studentContactEmail !== undefined) dbUpdates.student_contact_email = updates.studentContactEmail
  if (updates.advisorAgreementDate !== undefined) dbUpdates.advisor_agreement_date = updates.advisorAgreementDate
  if (updates.clubAgreementDate !== undefined) dbUpdates.club_agreement_date = updates.clubAgreementDate
  if (updates.status !== undefined) dbUpdates.status = updates.status
  if (updates.denialReason !== undefined) dbUpdates.denial_reason = updates.denialReason
  if (updates.approvedAt !== undefined) dbUpdates.approved_at = updates.approvedAt
  if (updates.socialMedia !== undefined) dbUpdates.social_media = updates.socialMedia
  if (updates.category !== undefined) dbUpdates.category = updates.category
  if (updates.notes !== undefined) dbUpdates.notes = updates.notes
  if (updates.renewedFromId !== undefined) dbUpdates.renewed_from_id = updates.renewedFromId

  dbUpdates.updated_at = new Date().toISOString()

  const { error } = await (client.from('club_registrations') as any)
    .update(dbUpdates)
    .eq('id', id)

  if (error) throw error
}

export async function deleteRegistration(id: string): Promise<void> {
  await ensureRegistrationsMigrated()
  
  const client = getAdminClient()
  const { error } = await (client.from('club_registrations') as any)
    .delete()
    .eq('id', id)

  if (error) throw error
}

export async function deleteAllRegistrations(): Promise<void> {
  await ensureRegistrationsMigrated()
  
  const client = getAdminClient()
  const { error } = await (client.from('club_registrations') as any)
    .delete()
    .neq('id', '')

  if (error) throw error
}

export async function deleteRegistrationsByCollection(collectionId: string): Promise<void> {
  await ensureRegistrationsMigrated()
  
  const client = getAdminClient()
  const { error } = await (client.from('club_registrations') as any)
    .delete()
    .eq('collection_id', collectionId)

  if (error) throw error
}
