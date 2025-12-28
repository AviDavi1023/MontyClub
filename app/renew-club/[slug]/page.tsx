'use client'

import { useState, useEffect, FormEvent } from 'react'
import { Search, CheckCircle2, RefreshCw, Send } from 'lucide-react'
import { ClubRegistration, RegistrationCollection } from '@/types/club'
import BackButton from '@/components/BackButton'
import { Button, Input, Textarea } from '@/components/ui'
import { useToast } from '@/lib/use-toast'
import { ToastContainer } from '@/components/Toast'

interface RenewClubPageProps {
  params: Promise<{
    slug: string
  }>
}

export default function RenewClubPage({ params }: RenewClubPageProps) {
  const [slug, setSlug] = useState<string>('')
  const [collection, setCollection] = useState<RegistrationCollection | null>(null)
  const [clubs, setClubs] = useState<ClubRegistration[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedClub, setSelectedClub] = useState<ClubRegistration | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [visibleClubsCount, setVisibleClubsCount] = useState(20)
  const { toasts, removeToast, showSuccess } = useToast()

  // Form fields - Required updates
  const [advisorName, setAdvisorName] = useState('')
  const [advisorEmail, setAdvisorEmail] = useState('')
  const [studentContactName, setStudentContactName] = useState('')
  const [studentContactEmail, setStudentContactEmail] = useState('')
  
  // Agreements
  const [agreementSupervision, setAgreementSupervision] = useState(false)
  const [agreementCodeOfConduct, setAgreementCodeOfConduct] = useState(false)
  const [agreementDataAccuracy, setAgreementDataAccuracy] = useState(false)

  // Optional updates - Pre-filled from selected club
  const [clubName, setClubName] = useState('')
  const [category, setCategory] = useState('')
  const [meetingFrequency, setMeetingFrequency] = useState('')
  const [socialMedia, setSocialMedia] = useState('')
  const [statementOfPurpose, setStatementOfPurpose] = useState('')

  useEffect(() => {
    const resolveParams = async () => {
      const { slug: paramSlug } = await params
      setSlug(paramSlug)
      await loadCollectionAndClubs(paramSlug)
    }
    resolveParams()
  }, [params])

  const loadCollectionAndClubs = async (collectionSlug: string) => {
    try {
      setLoading(true)
      setError('')
      
      console.log('[Renewal Form] Starting load for collection:', collectionSlug)
      
      // Fetch the collection to verify renewal is enabled (using public endpoint)
      console.log('[Renewal Form] Fetching collections from /api/collections-public')
      const collectionsRes = await fetch('/api/collections-public')
      
      if (!collectionsRes.ok) {
        console.error('[Renewal Form] Collections fetch failed:', collectionsRes.status)
        setError('Unable to verify collection')
        return
      }
      
      const collectionsData = await collectionsRes.json()
      console.log('[Renewal Form] Received collections:', collectionsData.collections?.length)
      
      const targetCollection = collectionsData.collections?.find((c: any) => c.id === collectionSlug)
      
      if (!targetCollection) {
        console.error('[Renewal Form] Target collection not found. Looking for:', collectionSlug)
        console.error('[Renewal Form] Available collections:', collectionsData.collections?.map((c: any) => c.id))
        setError('Collection not found')
        return
      }
      
      console.log('[Renewal Form] Found collection:', targetCollection.name, 'renewalEnabled:', targetCollection.renewalEnabled)
      
      // Check if renewal is enabled for this collection
      if (!targetCollection.renewalEnabled) {
        console.warn('[Renewal Form] Renewal not enabled for collection:', collectionSlug)
        setError('Club renewal is not available for this collection')
        return
      }
      
      setCollection(targetCollection)
      
      // Fetch clubs for renewal, excluding the target collection
      console.log('[Renewal Form] Fetching renewal clubs for:', collectionSlug)
      const clubsRes = await fetch(`/api/renewal-clubs?collectionId=${encodeURIComponent(collectionSlug)}`)
      
      if (!clubsRes.ok) {
        console.error('[Renewal Form] Clubs fetch failed:', clubsRes.status, clubsRes.statusText)
        const errData = await clubsRes.text()
        console.error('[Renewal Form] Error response:', errData)
        setError('Unable to load clubs for renewal.')
        return
      }
      
      const clubsData = await clubsRes.json()
      console.log('[Renewal Form] Received clubs:', clubsData.clubs?.length)
      
      if (!clubsData.clubs || clubsData.clubs.length === 0) {
        console.warn('[Renewal Form] No clubs available for renewal')
        setError('No clubs available for renewal')
        setClubs([])
      } else {
        console.log('[Renewal Form] Successfully loaded', clubsData.clubs.length, 'clubs')
        setClubs(clubsData.clubs)
      }
    } catch (err) {
      console.error('[Renewal Form] Exception during load:', err)
      setError('Failed to load renewal information')
    } finally {
      setLoading(false)
    }
  }

  const selectClub = (club: ClubRegistration) => {
    setSelectedClub(club)
    setClubName(club.clubName)
    setCategory(club.category || '')
    setMeetingFrequency(club.meetingFrequency || '')
    setSocialMedia(club.socialMedia || '')
    setStatementOfPurpose(club.statementOfPurpose || '')
    
    setAdvisorName('')
    setAdvisorEmail('')
    setStudentContactName('')
    setStudentContactEmail('')
    
    setAgreementSupervision(false)
    setAgreementCodeOfConduct(false)
    setAgreementDataAccuracy(false)
    
    setError('')
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (!selectedClub) {
      setError('Please select a club to renew')
      return
    }

    if (!slug) {
      setError('No collection specified')
      return
    }

    if (!advisorName || !advisorEmail || !studentContactName || !studentContactEmail) {
      setError('Please fill in all required contact information')
      return
    }

    if (!agreementSupervision || !agreementCodeOfConduct || !agreementDataAccuracy) {
      setError('Please accept all agreements')
      return
    }

    try {
      setSubmitting(true)
      const response = await fetch('/api/club-renewal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collectionId: slug,
          originalClubId: selectedClub.id,
          clubName,
          category,
          meetingFrequency,
          advisorName,
          advisorEmail,
          studentContactName,
          studentContactEmail,
          socialMedia,
          statementOfPurpose,
          agreements: {
            supervision: agreementSupervision,
            codeOfConduct: agreementCodeOfConduct,
            dataAccuracy: agreementDataAccuracy,
          },
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to submit renewal')
      }

      setSubmitted(true)
      showSuccess(`${clubName} renewal has been submitted successfully! You'll be notified once it's reviewed.`)
    } catch (err: any) {
      console.error('Renewal submission error:', err)
      setError(err.message || 'Failed to submit renewal')
    } finally {
      setSubmitting(false)
    }
  }

  const filteredClubs = clubs.filter(club =>
    club.clubName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    club.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    club.advisorName?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const visibleClubs = filteredClubs.slice(0, visibleClubsCount)
  const hasMoreClubs = visibleClubsCount < filteredClubs.length

  const loadMore = () => {
    setVisibleClubsCount(prev => Math.min(prev + 20, filteredClubs.length))
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
          <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
            <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Renewal Submitted!
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Your club renewal for <strong>{clubName}</strong> has been submitted successfully. You'll be notified once it's reviewed.
          </p>
          <Button
            variant="primary"
            onClick={() => window.location.href = '/'}
          >
            Return to Home
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <BackButton />
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Renew Your Club Charter
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Search for your club below to renew its charter
          </p>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-800 dark:text-red-400">{error}</p>
          </div>
        )}

        {!selectedClub ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Select Club to Renew
            </h2>
            
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by club name, category, or advisor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : clubs.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                No clubs available for renewal in this collection
              </p>
            ) : filteredClubs.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                No clubs match your search
              </p>
            ) : (
              <>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {visibleClubs.map((club) => (
                    <button
                      key={club.id}
                      onClick={() => selectClub(club)}
                      className="w-full text-left p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all"
                    >
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {club.clubName}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {club.category && <span className="mr-4">Category: {club.category}</span>}
                        {club.advisorName && <span>Advisor: {club.advisorName}</span>}
                      </div>
                    </button>
                  ))}
                </div>
                {hasMoreClubs && (
                  <button
                    onClick={loadMore}
                    className="w-full mt-4 px-4 py-2 text-sm text-primary-600 dark:text-primary-400 border border-primary-300 dark:border-primary-700 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                  >
                    Load More ({visibleClubsCount} of {filteredClubs.length})
                  </button>
                )}
              </>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Renewing: {selectedClub.clubName}
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Update contact information and review club details
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedClub(null)
                  setError('')
                }}
                className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
              >
                Change Club
              </button>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 space-y-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Required: Updated Contact Information
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Advisor Name"
                  value={advisorName}
                  onChange={(e) => setAdvisorName(e.target.value)}
                  required
                />

                <Input
                  label="Advisor Email"
                  type="email"
                  value={advisorEmail}
                  onChange={(e) => setAdvisorEmail(e.target.value)}
                  required
                />

                <Input
                  label="Student Contact Name"
                  value={studentContactName}
                  onChange={(e) => setStudentContactName(e.target.value)}
                  required
                />

                <Input
                  label="Student Contact Email"
                  type="email"
                  value={studentContactEmail}
                  onChange={(e) => setStudentContactEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Club Information (Review and Update if Needed)
              </h3>

              <Input
                label="Club Name"
                value={clubName}
                onChange={(e) => setClubName(e.target.value)}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />

                <Input
                  label="Meeting Frequency"
                  value={meetingFrequency}
                  onChange={(e) => setMeetingFrequency(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Social Media"
                  value={socialMedia}
                  onChange={(e) => setSocialMedia(e.target.value)}
                  placeholder="Instagram, etc."
                />
              </div>

              <Textarea
                label="Statement of Purpose"
                value={statementOfPurpose}
                onChange={(e) => setStatementOfPurpose(e.target.value)}
                rows={4}
              />
            </div>

            <div className="space-y-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Required Agreements *
              </h3>

              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreementSupervision}
                  onChange={(e) => setAgreementSupervision(e.target.checked)}
                  className="mt-1 w-4 h-4"
                  required
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  I confirm that this club will have proper adult supervision during all activities
                </span>
              </label>

              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreementCodeOfConduct}
                  onChange={(e) => setAgreementCodeOfConduct(e.target.checked)}
                  className="mt-1 w-4 h-4"
                  required
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  I agree to abide by the school's code of conduct and club policies
                </span>
              </label>

              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreementDataAccuracy}
                  onChange={(e) => setAgreementDataAccuracy(e.target.checked)}
                  className="mt-1 w-4 h-4"
                  required
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  I certify that all information provided is accurate and up to date
                </span>
              </label>
            </div>

            <div className="flex gap-3">
              <Button
                type="submit"
                variant="primary"
                disabled={submitting}
                isLoading={submitting}
                className="flex-1"
                icon={submitting ? undefined : <Send className="h-5 w-5" />}
              >
                {submitting ? 'Submitting...' : 'Submit Renewal'}
              </Button>
            </div>
          </form>
        )}
      </div>
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  )
}
