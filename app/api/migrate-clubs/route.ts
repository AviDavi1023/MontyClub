/**
 * API endpoint to manually trigger clubs migration from Storage to Postgres
 * Hit this with POST to migrate/resync all clubs from the source to Postgres
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchClubsFromCollection } from '@/lib/clubs'
import type { Club } from '@/types/club'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { clear } = await request.json().catch(() => ({}))

    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    const client = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    console.log('[MIGRATION] Manual sync triggered')

    // Optionally clear existing clubs first
    if (clear) {
      console.log('[MIGRATION] Clearing existing clubs table...')
      await (client.from('clubs') as any).delete().neq('id', '')
      console.log('[MIGRATION] Clubs table cleared')
    }

    // Get clubs from source (Storage/snapshot)
    console.log('[MIGRATION] Fetching clubs from source...')
    const clubs = await fetchClubsFromCollection()

    if (!clubs || clubs.length === 0) {
      console.log('[MIGRATION] No clubs found in source')
      return NextResponse.json({
        status: 'no-source-data',
        message: 'No clubs found in Storage to migrate'
      }, { status: 200 })
    }

    console.log(`[MIGRATION] Found ${clubs.length} clubs to sync:`)
    clubs.forEach(c => {
      console.log(`[MIGRATION]   - ${c.id}: ${c.name}`)
    })

    // Sync to Postgres
    let inserted = 0
    let updated = 0
    let failed = 0

    for (const club of clubs) {
      try {
        // Try to insert
        const { error: insertError } = await (client.from('clubs') as any)
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

        if (insertError?.code === '23505') {
          // Club already exists, update it
          const { error: updateError } = await (client.from('clubs') as any)
            .update({
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
              keywords: club.keywords || [],
            })
            .eq('id', club.id)

          if (updateError) {
            console.error(`[MIGRATION] Failed to update club ${club.id}:`, updateError)
            failed++
          } else {
            updated++
          }
        } else if (insertError) {
          console.error(`[MIGRATION] Failed to insert club ${club.id}:`, insertError)
          failed++
        } else {
          inserted++
        }
      } catch (e) {
        console.error(`[MIGRATION] Exception processing club ${club.id}:`, e)
        failed++
      }
    }

    console.log(
      `[MIGRATION] Complete: ${inserted} inserted, ${updated} updated, ${failed} failed`
    )

    return NextResponse.json({
      status: 'success',
      inserted,
      updated,
      failed,
      total: clubs.length,
      clubs: clubs.map(c => ({ id: c.id, name: c.name }))
    })

  } catch (error) {
    console.error('[MIGRATION ERROR]:', error)
    return NextResponse.json({
      error: 'Migration failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
