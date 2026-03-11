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
  const [advisorEmailError, setAdvisorEmailError] = useState('')
  const [studentEmailError, setStudentEmailError] = useState('')
  const validateEmail = (v: string) => /\S+@\S+\.\S+/.test(v)
  
  // Agreements
  const [agreementSupervision, setAgreementSupervision] = useState(false)
  const [agreementCodeOfConduct, setAgreementCodeOfConduct] = useState(false)
  const [agreementDataAccuracy, setAgreementDataAccuracy] = useState(false)

  // Optional updates - Pre-filled from selected club
  const [clubName, setClubName] = useState('')
  const [category, setCategory] = useState('')
  const [customCategory, setCustomCategory] = useState('')
  const [meetingFrequency, setMeetingFrequency] = useState('')
  const [customFrequency, setCustomFrequency] = useState('')
  const [meetingDay, setMeetingDay] = useState('')
  const [socialMedia, setSocialMedia] = useState('')
  const [statementOfPurpose, setStatementOfPurpose] = useState('')

  const frequencyOptions = [
    'Weekly',
    '1st and 3rd weeks of the month',
    '2nd and 4th weeks of the month',
    '1st week only',
    '2nd week only',
    '3rd week only',
    '4th week only',
    'Other'
  ]

  useEffect(() => {
    const resolveParams = async () => {
      const { slug: paramSlug } = await params
      setSlug(paramSlug)
      await loadCollectionAndClubs(paramSlug)
    }
    resolveParams()
  }, [params])

  // Auto-scroll to top when error appears
  useEffect(() => {
    if (error) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [error])

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
      
      // Try matching by ID first (preferred), then by name slug (legacy compatibility)
      let targetCollection = collectionsData.collections?.find((c: any) => c.id === collectionSlug)
      
      if (!targetCollection) {
        // Fallback: try matching by slugified name (for backward compatibility with name-based URLs)
        const { slugifyName } = await import('@/lib/slug')
        targetCollection = collectionsData.collections?.find((c: any) => 
          slugifyName(c.name) === slugifyName(collectionSlug)
        )
      }
      
      if (!targetCollection) {
        console.error('[Renewal Form] Target collection not found. Looking for:', collectionSlug)
        console.error('[Renewal Form] Available collections:', collectionsData.collections?.map((c: any) => ({ 
          id: c.id, 
          name: c.name, 
          renewalEnabled: c.renewalEnabled,
          accepting: c.accepting 
        })))
        setError('Collection not found. Please check the renewal link and try again.')
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
      
      // Fetch clubs for renewal from the configured source collections
      // Use the actual collection ID (not the slug) for the API call
      console.log('[Renewal Form] Fetching renewal clubs for:', targetCollection.id)
      const clubsRes = await fetch(`/api/renewal-clubs?collectionId=${encodeURIComponent(targetCollection.id)}`)
      
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
    setCustomCategory('')
    setMeetingFrequency(club.meetingFrequency || '')
    setCustomFrequency('')
    setMeetingDay(club.meetingDay || '')
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
      
      const finalFrequency = meetingFrequency === 'Other' ? customFrequency : meetingFrequency
      const finalCategory = category === 'Other' ? customCategory : category
      
      if (!meetingDay) {
        setError('Please select at least one meeting day')
        setSubmitting(false)
        return
      }
      
      if (!finalFrequency) {
        setError('Please select a meeting frequency')
        setSubmitting(false)
        return
      }
      
      if (!finalCategory) {
        setError('Please select a category')
        setSubmitting(false)
        return
      }
      
      const response = await fetch('/api/club-renewal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collectionId: collection?.id, // Use the actual collection ID, not the URL slug
          originalClubId: selectedClub.id,
          clubName,
          category: finalCategory,
          meetingFrequency: finalFrequency,
          meetingDay,
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
          <div className="flex justify-center">
            <Button
              variant="primary"
              onClick={() => window.location.href = '/'}
            >
              Return to Home
            </Button>
          </div>
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
                  label="Advisor Last Name (then first initial)"
                  value={advisorName}
                  onChange={(e) => setAdvisorName(e.target.value)}
                  placeholder="e.g., Smith J"
                  required
                />

                <Input
                  label="Advisor Email"
                  type="email"
                  value={advisorEmail}
                  onChange={(e) => {
                    const v = e.target.value
                    setAdvisorEmail(v)
                    setAdvisorEmailError(validateEmail(v) ? '' : 'Please enter a valid email address')
                  }}
                  required
                  error={advisorEmailError || undefined}
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
                  onChange={(e) => {
                    const v = e.target.value
                    setStudentContactEmail(v)
                    setStudentEmailError(validateEmail(v) ? '' : 'Please enter a valid email address')
                  }}
                  required
                  error={studentEmailError || undefined}
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

              {/* Category Dropdown */}
              <div>
                <label htmlFor="category" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  id="category"
                  required
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                >
                  <option value="">Select a category</option>
                  <option value="Awareness">Awareness</option>
                  <option value="Business">Business</option>
                  <option value="Debate/Political">Debate/Political</option>
                  <option value="Education">Education</option>
                  <option value="Culture">Culture</option>
                  <option value="Performing Arts">Performing Arts</option>
                  <option value="Cultural/Religious">Cultural/Religious</option>
                  <option value="Service">Service</option>
                  <option value="Social">Social</option>
                  <option value="STEM">STEM</option>
                  <option value="Other">Other</option>
                </select>
                {category === 'Other' && (
                  <Input
                    type="text"
                    placeholder="Please specify your category"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    className="mt-2"
                  />
                )}
              </div>

              {/* Meeting Day */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Meeting Day of Week <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  Select all days that apply
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => (
                    <label key={day} className="flex items-center gap-2 p-2 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <input
                        type="checkbox"
                        checked={meetingDay.includes(day)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setMeetingDay(meetingDay ? `${meetingDay}, ${day}` : day)
                          } else {
                            const days = meetingDay.split(', ').filter(d => d !== day)
                            setMeetingDay(days.join(', '))
                          }
                        }}
                        className="flex-shrink-0"
                      />
                      <span className="text-sm text-gray-900 dark:text-white">{day}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Meeting Frequency Dropdown */}
              <div>
                <label htmlFor="meetingFrequency" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Frequency <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  "Every other week" and "Once a month" is not specific enough.
                </p>
                <select
                  id="meetingFrequency"
                  required
                  value={meetingFrequency}
                  onChange={(e) => setMeetingFrequency(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                >
                  <option value="">Select frequency</option>
                  {frequencyOptions.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
                {meetingFrequency === 'Other' && (
                  <Input
                    type="text"
                    placeholder="Please specify"
                    value={customFrequency}
                    onChange={(e) => setCustomFrequency(e.target.value)}
                    className="mt-2"
                  />
                )}
              </div>

              <Input
                label="Social Media (optional)"
                value={socialMedia}
                onChange={(e) => setSocialMedia(e.target.value)}
                placeholder="@yourclub or https://..."
                helperText="Provide an @ for Instagram, a link (website, YouTube, etc.), or skip this."
              />

              <Textarea
                label="Statement of Purpose"
                value={statementOfPurpose}
                onChange={(e) => setStatementOfPurpose(e.target.value)}
                rows={4}
                maxLength={500}
              />
            </div>

            <div className="space-y-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Required Agreements *
              </h3>

              {/* Club Advisor Agreement */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Club Advisor Agreement <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  As the advisor of this club, I agree that I will be present at all club meetings and activities. If applicable, I agree to supervise all club fundraisers and deposit or store the money with the School Treasurer or Activities Director within 24 hours of the fundraising activity. Also, I agree to follow the proper money handling and expenditure procedures as set forth by the California State Ed. Code and the Carlmont Trust Agreement. If this is a renewal, I agree that all club officers have been fairly elected by the members of the club. If this is a new or unrenewed club, I agree that all club officers will be fairly elected by the members of the club.
                </p>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreementSupervision}
                    onChange={(e) => setAgreementSupervision(e.target.checked)}
                    className="mt-1 w-4 h-4"
                    required
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    I agree to the above Club Advisor Agreement
                  </span>
                </label>
              </div>

              {/* Club Agreement */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Club Agreement <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  By submitting this form, we (club advisor and officers) agree that we will abide by all school, Ed. Code, and ASB rules pertaining to club functions. We will meet as indicated. We will notify ASB should any of the above information change. We agree that not fulfilling our agreed upon meetings and club activities may result in deactivation of the club in this and possibly following school years. We agree that all club activities must be school appropriate and are expected, unless otherwise approved, to be conducted on campus. We understand that off-campus club activities require field trip paperwork. Also, because it is against California State Ed. Code, we understand that ASB cannot approve any clubs whose purpose is to raise money for charity.
                </p>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreementCodeOfConduct}
                    onChange={(e) => setAgreementCodeOfConduct(e.target.checked)}
                    className="mt-1 w-4 h-4"
                    required
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    I agree to the above Club Agreement
                  </span>
                </label>
              </div>

              {/* Data Accuracy */}
              {/* Data Accuracy */}
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
                disabled={submitting || !!advisorEmailError || !!studentEmailError}
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
