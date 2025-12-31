'use client'

import { useState, FormEvent, useEffect } from 'react'
import { Send, CheckCircle2, XCircle, Moon, Sun, RefreshCw } from 'lucide-react'
import { getUserFriendlyError } from '@/lib/error-messages'
import { RegistrationCollection } from '@/types/club'
import { Button, Input, Textarea } from '@/components/ui'
import BackButton from '@/components/BackButton'
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
  const [emailError, setEmailError] = useState('')
  const [studentEmailError, setStudentEmailError] = useState('')
  const validateEmail = (v: string) => /\S+@\S+\.\S+/.test(v)

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

      if (advisorAgreementDate !== 'agreed') {
        setError('Please agree to the Club Advisor Agreement.')
        setSubmitting(false)
        document.querySelector('[name="advisorAgreement"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        return
      }

      if (clubAgreementDate !== 'agreed') {
        setError('Please agree to the Club Agreement.')
        setSubmitting(false)
        document.querySelector('[name="clubAgreement"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        return
      }

      if (notes !== 'data-accurate') {
        setError('Please certify that all information is accurate.')
        setSubmitting(false)
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
          advisorAgreementDate: new Date().toISOString(),
          clubAgreementDate: new Date().toISOString(),
          socialMedia,
          category: finalCategory,
          notes: ''
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
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center justify-center">
          <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </div>
    )
  }

  if (error && !collection) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
          <div className="mx-auto w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mb-4">
            <XCircle className="h-10 w-10 text-yellow-600 dark:text-yellow-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Invalid Link
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            {error}
          </p>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
          <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
            <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Registration Submitted!
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Your club charter request has been received. You will be notified via email once it has been reviewed.
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
        
        {/* Header Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                Club Charter Request
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Submit a new club charter for review
              </p>
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
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-800 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Main Form Card */}
        <form onSubmit={handleSubmit}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 space-y-6">
            <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                This request must be completed by the advisor who must be a Carlmont teacher. Please note that the California Education Code states that clubs cannot raise funds for charitable causes. Clubs are not allowed to discriminate based on gender, race, ethnicity, religion, or ability level. If certain members do not have the required ability to perform for the club if necessary, they must be allowed to join the club as "board members." Club members cannot be required to pay membership dues.
              </p>
            </div>

        <Input
          label="Email"
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => {
            const v = e.target.value
            setEmail(v)
            setEmailError(validateEmail(v) ? '' : 'Please enter a valid email address')
          }}
          error={emailError || undefined}
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
          helperText={"Describe your club's goals and activities."}
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
        <div id="meetingDaySection">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Meeting Day of Week <span className="text-red-500">*</span>
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
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
            <p className="text-xs text-red-600 dark:text-red-400 mt-2">Please select at least one day</p>
          )}
        </div>

        {/* Meeting Frequency */}
        <div>
          <label htmlFor="meetingFrequency" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Frequency <span className="text-red-500">*</span>
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
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
          onChange={(e) => {
            const v = e.target.value
            setStudentContactEmail(v)
            setStudentEmailError(validateEmail(v) ? '' : 'Please enter a valid email address')
          }}
          error={studentEmailError || undefined}
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
              id="customCategory"
              placeholder="Please specify your category"
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
              className="mt-2"
            />
          )}
        </div>

        {/* Agreements Section */}
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
              As the advisor of this club, I agree that I will be present at all club meetings and activities. If applicable, I agree to supervise all club fundraisers and deposit or store the money with the School Treasurer or Activities Director within 24 hours of the fundraising activity. Also, I agree to follow the proper money handling and expenditure procedures as set forth by the California State Ed. Code and the Carlmont Trust Agreement. If this is a new club, I agree that all club officers will be fairly elected by the members of the club.
            </p>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={advisorAgreementDate === 'agreed'}
                onChange={(e) => setAdvisorAgreementDate(e.target.checked ? 'agreed' : '')}
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
                checked={clubAgreementDate === 'agreed'}
                onChange={(e) => setClubAgreementDate(e.target.checked ? 'agreed' : '')}
                className="mt-1 w-4 h-4"
                required
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                I agree to the above Club Agreement
              </span>
            </label>
          </div>

          {/* Data Accuracy */}
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={notes === 'data-accurate'}
              onChange={(e) => setNotes(e.target.checked ? 'data-accurate' : '')}
              className="mt-1 w-4 h-4"
              required
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              I certify that all information provided is accurate and up to date
            </span>
          </label>        </div>
        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <Button
            type="submit"
            variant="primary"
            disabled={submitting || !!emailError || !!studentEmailError}
            isLoading={submitting}
            className="w-full"
            icon={!submitting ? <Send className="h-4 w-4" /> : undefined}
          >
            {submitting ? 'Submitting...' : 'Submit Charter Request'}
          </Button>
        </div>
          </div>
        </form>
      </div>
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  )
}
