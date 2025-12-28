'use client'

import { useState, FormEvent, useEffect } from 'react'
import { Send, CheckCircle2, XCircle, Moon, Sun } from 'lucide-react'
import { getUserFriendlyError } from '@/lib/error-messages'
import { RegistrationCollection } from '@/types/club'
import { Button, Input, Textarea } from '@/components/ui'
import { useToast } from '@/lib/use-toast'
import { ToastContainer } from '@/components/Toast'

interface ClubRegistrationFormProps {
  collectionSlug?: string
}

export function ClubRegistrationForm({ collectionSlug }: ClubRegistrationFormProps) {
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [collection, setCollection] = useState<RegistrationCollection | null>(null)
  const [loading, setLoading] = useState(true)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const { toasts, removeToast, showSuccess } = useToast()

  // Form state
  const [email, setEmail] = useState('')
  const [clubName, setClubName] = useState('')
  const [advisorName, setAdvisorName] = useState('')
  const [statementOfPurpose, setStatementOfPurpose] = useState('')
  const [location, setLocation] = useState('')
  const [meetingDay, setMeetingDay] = useState('')
  const [meetingFrequency, setMeetingFrequency] = useState('')
  const [customFrequency, setCustomFrequency] = useState('')
  const [studentContactName, setStudentContactName] = useState('')
  const [studentContactEmail, setStudentContactEmail] = useState('')
  const [advisorAgreementDate, setAdvisorAgreementDate] = useState('')
  const [clubAgreementDate, setClubAgreementDate] = useState('')
  const [socialMedia, setSocialMedia] = useState('')
  const [category, setCategory] = useState('')
  const [customCategory, setCustomCategory] = useState('')
  const [notes, setNotes] = useState('')

  // Check collection status
  useEffect(() => {
    // Check if dark mode is enabled
    if (typeof window !== 'undefined') {
      setIsDarkMode(document.documentElement.classList.contains('dark'))
    }
    
    const checkCollectionStatus = async () => {
      if (!collectionSlug) {
        setError('No collection specified. Please use a valid registration link.')
        setLoading(false)
        return
      }

      try {
        // We'll validate the collection when submitting
        setCollection({ id: collectionSlug, name: collectionSlug, enabled: true, createdAt: '' })
      } catch (err) {
        console.error('Error checking collection status:', err)
        setError('Unable to verify collection status.')
      } finally {
        setLoading(false)
      }
    }
    checkCollectionStatus()
  }, [collectionSlug])

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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const finalFrequency = meetingFrequency === 'Other' ? customFrequency : meetingFrequency
      const finalCategory = category === 'Other' ? customCategory : category

      if (!meetingDay) {
        setError('Please select at least one meeting day.')
        setSubmitting(false)
        document.getElementById('meetingDaySection')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        return
      }

      if (!finalFrequency && meetingFrequency === 'Other') {
        setError('Please specify your custom frequency.')
        setSubmitting(false)
        document.getElementById('meetingFrequency')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        return
      }

      if (!finalCategory) {
        setError('Please select a category.')
        setSubmitting(false)
        document.getElementById('category')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        return
      }

      if (category === 'Other' && !customCategory.trim()) {
        setError('Please specify your category since you selected "Other".')
        setSubmitting(false)
        document.getElementById('customCategory')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        return
      }

      const response = await fetch(`/api/club-registration?collection=${encodeURIComponent(collectionSlug || '')}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          clubName,
          advisorName,
          statementOfPurpose,
          location,
          meetingDay,
          meetingFrequency: finalFrequency,
          studentContactName,
          studentContactEmail,
          advisorAgreementDate,
          clubAgreementDate,
          socialMedia,
          category: finalCategory,
          notes
        })
      })

      if (!response.ok) {
        const data = await response.json()
        if (response.status === 403) {
          throw new Error('Registration is currently closed for this collection. Please check back later.')
        }
        throw new Error(data.error || 'Failed to submit registration')
      }

      setSubmitted(true)
      showSuccess(`${clubName} has been registered successfully! Check your email for confirmation.`)
      
      // Reset form after success
      setTimeout(() => {
        setEmail('')
        setClubName('')
        setAdvisorName('')
        setStatementOfPurpose('')
        setLocation('')
        setMeetingDay('')
        setMeetingFrequency('')
        setCustomFrequency('')
        setStudentContactName('')
        setStudentContactEmail('')
        setAdvisorAgreementDate('')
        setClubAgreementDate('')
        setSocialMedia('')
        setCategory('')
        setCustomCategory('')
        setNotes('')
        setSubmitted(false)
      }, 5000)
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-6 flex items-center justify-center min-h-[400px]">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary-600 border-t-transparent"></div>
      </div>
    )
  }

  if (error && !collection) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-8 text-center">
          <XCircle className="h-16 w-16 text-yellow-600 dark:text-yellow-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-yellow-900 dark:text-yellow-100 mb-2">
            Invalid Link
          </h2>
          <p className="text-yellow-700 dark:text-yellow-300">
            {error}
          </p>
        </div>
      </div>
    )
  }

  if (submitted) {
    // Scroll to top when success screen shows
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-8 text-center">
          <CheckCircle2 className="h-16 w-16 text-green-600 dark:text-green-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-green-900 dark:text-green-100 mb-2">
            Registration Submitted!
          </h2>
          <p className="text-green-700 dark:text-green-300">
            Your club charter request has been received. You will be notified via email once it has been reviewed.
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-6">
      {/* Collection Tagging (hidden input, visible for admin context) */}
      {collectionSlug && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Registration Collection
          </label>
          <input
            type="text"
            value={collectionSlug}
            readOnly
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white cursor-not-allowed"
            tabIndex={-1}
            aria-readonly="true"
          />
          <input type="hidden" name="collection" value={collectionSlug} />
        </div>
      )}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Club Charter Request
            </h1>
          </div>
          <button
            type="button"
            onClick={() => {
              const html = document.documentElement
              const isDark = html.classList.contains('dark')
              if (isDark) {
                html.classList.remove('dark')
              } else {
                html.classList.add('dark')
              }
              setIsDarkMode(!isDark)
            }}
            className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Toggle dark mode"
            aria-label="Toggle dark mode"
          >
            {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          This request must be completed by the advisor who must be a Carlmont teacher. Please note that the California Education Code states that clubs cannot raise funds for charitable causes. Clubs are not allowed to discriminate based on gender, race, ethnicity, religion, or ability level. If certain members do not have the required ability to perform for the club if necessary, they must be allowed to join the club as "board members." Club members cannot be required to pay membership dues.
        </p>

        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        <Input
          label="Email"
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <Input
          label="Club Name Requested"
          id="clubName"
          type="text"
          required
          value={clubName}
          onChange={(e) => setClubName(e.target.value)}
          helperText="Do not use the word 'Carlmont' at the beginning. Final approval will be determined by ASB."
        />

        <Input
          label="Advisor Last Name (then first initial)"
          id="advisorName"
          type="text"
          required
          placeholder="e.g., Smith J"
          value={advisorName}
          onChange={(e) => setAdvisorName(e.target.value)}
        />

        <Textarea
          label="Club Statement of Purpose"
          id="statementOfPurpose"
          required
          maxLength={250}
          value={statementOfPurpose}
          onChange={(e) => setStatementOfPurpose(e.target.value)}
          rows={4}
          helperText={`${statementOfPurpose.length}/250 characters`}
        />

        <Input
          label="Room Number or Location"
          id="location"
          type="text"
          required
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />

        {/* Meeting Day */}
        <div id="meetingDaySection" className="mb-6">
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
          {!meetingDay && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">Please select at least one day</p>
          )}
        </div>

        {/* Meeting Frequency */}
        <div className="mb-6">
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
          label="Student Contact Name"
          id="studentContactName"
          type="text"
          required
          value={studentContactName}
          onChange={(e) => setStudentContactName(e.target.value)}
          helperText="This person is the club's contact for ASB communications. They do not have to be one of the club officers."
        />

        <Input
          label="Student Contact Email"
          id="studentContactEmail"
          type="email"
          required
          value={studentContactEmail}
          onChange={(e) => setStudentContactEmail(e.target.value)}
          helperText="Please use the seq.org email address. It is expected that this person actively checks their school email."
        />

        <Input
          label="Social Media (optional)"
          id="socialMedia"
          type="text"
          value={socialMedia}
          onChange={(e) => setSocialMedia(e.target.value)}
          placeholder="@yourclub or https://..."
          helperText="Provide an @ for Instagram, a link (website, YouTube, etc.), or skip this."
        />

        {/* Category (required) */}
        <div className="mb-6">
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
              id="customCategory"
              placeholder="Please specify your category"
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
              className="mt-2"
            />
          )}
        </div>

        <Textarea
          label="Notes (optional)"
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          helperText="Any public notes to be displayed on the clubs discovery site about registration, requirements, dates, etc."
        />

        {/* Club Advisor Agreement */}
        <div className="mb-6">
          <label htmlFor="advisorAgreementDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Club Advisor Agreement <span className="text-red-500">*</span>
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            As the advisor of this club, I agree that I will be present at all club meetings and activities. If applicable, I agree to supervise all club fundraisers and deposit or store the money with the School Treasurer or Activities Director within 24 hours of the fundraising activity. Also, I agree to follow the proper money handling and expenditure procedures as set forth by the California State Ed. Code and the Carlmont Trust Agreement. If this is a renewal, I agree that all club officers have been fairly elected by the members of the club. If this is a new or unrenewed club, I agree that all club officers will be fairly elected by the members of the club.
          </p>
          <input
            type="date"
            id="advisorAgreementDate"
            required
            value={advisorAgreementDate}
            onChange={(e) => setAdvisorAgreementDate(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
          />
        </div>

        {/* Club Agreement */}
        <div className="mb-6">
          <label htmlFor="clubAgreementDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Club Agreement <span className="text-red-500">*</span>
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            By submitting this form, we (club advisor and officers) agree that we will abide by all school, Ed. Code, and ASB rules pertaining to club functions. We will meet as indicated. We will notify ASB should any of the above information change. We agree that not fulfilling our agreed upon meetings and club activities may result in deactivation of the club in this and possibly following school years. We agree that all club activities must be school appropriate and are expected, unless otherwise approved, to be conducted on campus. We understand that off-campus club activities require field trip paperwork. Also, because it is against California State Ed. Code, we understand that ASB cannot approve any clubs whose purpose is to raise money for charity.
          </p>
          <input
            type="date"
            id="clubAgreementDate"
            required
            value={clubAgreementDate}
            onChange={(e) => setClubAgreementDate(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
          />
        </div>

        <Button
          type="submit"
          variant="primary"
          disabled={submitting}
          isLoading={submitting}
          className="w-full"
          icon={!submitting ? <Send className="h-4 w-4" /> : undefined}
        >
          {submitting ? 'Submitting...' : 'Submit Charter Request'}
        </Button>
      </div>
    </form>
    <ToastContainer toasts={toasts} onClose={removeToast} />
    </>
  )
}
