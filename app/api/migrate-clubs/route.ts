/**
 * API endpoint to manually trigger clubs migration from Storage to Postgres
 * Hit this once to migrate all legacy clubs
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Club } from '@/types/club'

export const dynamic = 'force-dynamic'

export async function POST() {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
  }

  const client = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  try {
    console.log('[MIGRATION] Starting clubs migration...')

    // Check if clubs already exist
    const { count: existingCount } = await (client.from('clubs') as any)
      .select('*', { count: 'exact', head: true })

    console.log(`[MIGRATION] Current clubs in database: ${existingCount}`)

    if (existingCount && existingCount > 0) {
      console.log('[MIGRATION] Database already has clubs, skipping migration')
      return NextResponse.json({ 
        status: 'already-migrated',
        clubsCount: existingCount 
      })
    }

    // Try to list files in Storage
    console.log('[MIGRATION] Attempting to list clubs in Storage...')
    const { data: existingClubs, error: listError } = await client
      .storage
      .from('clubs')
      .list('clubs', { limit: 1000 })

    if (listError) {
      console.error('[MIGRATION ERROR] Failed to list Storage:', listError)
      return NextResponse.json({ 
        error: 'Failed to list Storage files',
        details: listError
      }, { status: 500 })
    }

    if (!existingClubs || existingClubs.length === 0) {
      console.log('[MIGRATION] No club files found in Storage')
      return NextResponse.json({ 
        status: 'no-source-data',
        message: 'No clubs found in Storage to migrate'
      }, { status: 200 })
    }

    console.log(`[MIGRATION] Found ${existingClubs.length} files in Storage`)

    // Read all club JSON files
    const clubFiles = existingClubs.filter(f => f.name.endsWith('.json'))
    console.log(`[MIGRATION] Found ${clubFiles.length} JSON files`)

    const migratedClubs: Club[] = []
    let failedCount = 0

    for (const file of clubFiles) {
      try {
        const { data: fileData, error: downloadError } = await client
          .storage
          .from('clubs')
          .download(`clubs/${file.name}`)

        if (downloadError || !fileData) {
          console.warn(`[MIGRATION] Failed to download ${file.name}:`, downloadError)
          failedCount++
          continue
        }

        const text = await fileData.text()
        const club: Club = JSON.parse(text)
        
        console.log(`[MIGRATION] Read club: ${club.id} - ${club.name}`)
        migratedClubs.push(club)
      } catch (e) {
        console.warn(`[MIGRATION] Failed to process ${file.name}:`, e)
        failedCount++
      }
    }

    if (migratedClubs.length === 0) {
      console.log('[MIGRATION] No valid clubs found to migrate')
      return NextResponse.json({ 
        status: 'parse-failed',
        message: 'Could not parse any clubs from Storage files'
      }, { status: 200 })
    }

    console.log(`[MIGRATION] Successfully parsed ${migratedClubs.length} clubs, inserting into Postgres...`)

    // Insert all clubs into Postgres
    let insertedCount = 0
    for (const club of migratedClubs) {
      try {
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
        insertedCount++
      } catch (insertError) {
        console.error(`[MIGRATION] Failed to insert club ${club.id}:`, insertError)
      }
    }

    console.log(`[MIGRATION] Successfully inserted ${insertedCount}/${migratedClubs.length} clubs`)

    return NextResponse.json({ 
      status: 'success',
      migratedCount: insertedCount,
      failedCount: failedCount,
      totalAttempted: migratedClubs.length
    })

  } catch (error) {
    console.error('[MIGRATION ERROR] Unexpected error:', error)
    return NextResponse.json({ 
      error: 'Migration failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
