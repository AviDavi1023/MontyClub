import { Club } from '@/types/club'
import { ensureSingleDisplay, listCollections } from '@/lib/collections-db'
import { listRegistrations } from '@/lib/registrations-db'
import { writeJSONToStorage } from '@/lib/supabase'
import { invalidateClubsCache } from '@/lib/cache-utils'
import { readData } from '@/lib/runtime-store'
import { getAllAnnouncements } from '@/lib/announcements-db'

export interface PublishSnapshotOptions {
  autoAssignDisplayCollection?: boolean
}

export interface PublishSnapshotResult {
  generatedAt: string
  clubCount: number
  collectionId: string
  collectionName: string
}

export async function publishCatalogSnapshot(
  options: PublishSnapshotOptions = {}
): Promise<PublishSnapshotResult> {
  const { autoAssignDisplayCollection = false } = options

  const collections = await listCollections()
  let displayCollection = collections.find((c) => c.display)

  if (!displayCollection && autoAssignDisplayCollection && collections.length > 0) {
    await ensureSingleDisplay(collections[0].id)
    displayCollection = { ...collections[0], display: true }
  }

  if (!displayCollection) {
    throw new Error('No display collection configured. Please select a collection as "Public Catalog" in Settings.')
  }

  const registrations = await listRegistrations({
    collectionId: displayCollection.id,
    status: 'approved',
  })

  registrations.sort((a, b) => {
    const timeA = a.approvedAt ? new Date(a.approvedAt).getTime() : new Date(a.submittedAt).getTime()
    const timeB = b.approvedAt ? new Date(b.approvedAt).getTime() : new Date(b.submittedAt).getTime()
    return timeB - timeA
  })

  const clubs: Club[] = registrations.map((r) => ({
    id: r.id,
    name: r.clubName,
    category: r.category || '',
    description: r.statementOfPurpose,
    advisor: r.advisorName,
    studentLeader: r.studentContactName,
    meetingTime: r.meetingDay,
    meetingFrequency: r.meetingFrequency,
    location: r.location,
    contact: r.studentContactEmail,
    socialMedia: r.socialMedia || '',
    active: true,
    notes: r.notes || '',
    announcement: '',
    keywords: [],
  }))

  try {
    const settings = await readData('settings', { announcementsEnabled: true })
    if (settings.announcementsEnabled !== false) {
      const announcements = await getAllAnnouncements()
      clubs.forEach((club) => {
        const id = String(club.id).trim()
        if (announcements[id] && announcements[id].trim() !== '') {
          club.announcement = announcements[id].trim()
        }
      })
    }
  } catch (error) {
    console.warn('[Snapshot] Could not merge announcements while publishing snapshot:', error)
  }

  const generatedAt = new Date().toISOString()
  const snapshot = {
    clubs,
    metadata: {
      generatedAt,
      collectionId: displayCollection.id,
      collectionName: displayCollection.name,
      clubCount: clubs.length,
      version: 1,
    },
  }

  const success = await writeJSONToStorage('settings/clubs-snapshot.json', snapshot)
  if (!success) {
    throw new Error('Failed to write snapshot to storage')
  }

  invalidateClubsCache()

  return {
    generatedAt,
    clubCount: clubs.length,
    collectionId: displayCollection.id,
    collectionName: displayCollection.name,
  }
}
