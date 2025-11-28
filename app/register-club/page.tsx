import { ClubRegistrationForm } from '@/components/ClubRegistrationForm'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Club Charter Request - MontyClub',
  description: 'Submit a new club charter request for Carlmont High School',
}

export default function RegisterClubPage({
  searchParams,
}: {
  searchParams: { collection?: string }
}) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <ClubRegistrationForm collectionSlug={searchParams.collection} />
    </div>
  )
}
