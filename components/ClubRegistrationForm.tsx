'use client'

import { useState, FormEvent } from 'react'
import { Send, CheckCircle2 } from 'lucide-react'

export function ClubRegistrationForm() {
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

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

      if (!finalFrequency && meetingFrequency === 'Other') {
        setError('Please specify your custom frequency.')
        setSubmitting(false)
        return
      }

      const response = await fetch('/api/club-registration', {
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
          clubAgreementDate
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to submit registration')
      }

      setSubmitted(true)
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
        setSubmitted(false)
      }, 5000)
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
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
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Club Charter Request
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          This request must be completed by the advisor who must be a Carlmont teacher. Please note that the California Education Code states that clubs cannot raise funds for charitable causes. Clubs are not allowed to discriminate based on gender, race, ethnicity, religion, or ability level. If certain members do not have the required ability to perform for the club if necessary, they must be allowed to join the club as "board members." Club members cannot be required to pay membership dues.
        </p>

        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Email */}
        <div className="mb-6">
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            id="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
          />
        </div>

        {/* Club Name */}
        <div className="mb-6">
          <label htmlFor="clubName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Club Name Requested <span className="text-red-500">*</span>
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            Do not use the word "Carlmont" at the beginning of your club name. Also, your club name is only a request. Final approval of club names will be determined by ASB.
          </p>
          <input
            type="text"
            id="clubName"
            required
            value={clubName}
            onChange={(e) => setClubName(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
          />
        </div>

        {/* Advisor Name */}
        <div className="mb-6">
          <label htmlFor="advisorName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Advisor Last Name (then first initial) <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="advisorName"
            required
            placeholder="e.g., Smith J"
            value={advisorName}
            onChange={(e) => setAdvisorName(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
          />
        </div>

        {/* Statement of Purpose */}
        <div className="mb-6">
          <label htmlFor="statementOfPurpose" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Club Statement of Purpose <span className="text-red-500">*</span>
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            Please give a brief statement of the club's purpose. Please indicate here if the club is associated with an outside organization. 250 character maximum.
          </p>
          <textarea
            id="statementOfPurpose"
            required
            maxLength={250}
            value={statementOfPurpose}
            onChange={(e) => setStatementOfPurpose(e.target.value)}
            rows={4}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {statementOfPurpose.length}/250 characters
          </p>
        </div>

        {/* Location */}
        <div className="mb-6">
          <label htmlFor="location" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Room Number or Location <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="location"
            required
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
          />
        </div>

        {/* Meeting Day */}
        <div className="mb-6">
          <label htmlFor="meetingDay" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Meeting Day of Week <span className="text-red-500">*</span>
          </label>
          <select
            id="meetingDay"
            required
            value={meetingDay}
            onChange={(e) => setMeetingDay(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
          >
            <option value="">Select a day</option>
            <option value="Monday">Monday</option>
            <option value="Tuesday">Tuesday</option>
            <option value="Wednesday">Wednesday</option>
            <option value="Thursday">Thursday</option>
            <option value="Friday">Friday</option>
          </select>
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
            <input
              type="text"
              placeholder="Please specify"
              value={customFrequency}
              onChange={(e) => setCustomFrequency(e.target.value)}
              className="w-full px-4 py-2 mt-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            />
          )}
        </div>

        {/* Student Contact Name */}
        <div className="mb-6">
          <label htmlFor="studentContactName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Student Contact Name <span className="text-red-500">*</span>
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            This person is the club's contact for ASB communications. They do not have to be one of the club officers.
          </p>
          <input
            type="text"
            id="studentContactName"
            required
            value={studentContactName}
            onChange={(e) => setStudentContactName(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
          />
        </div>

        {/* Student Contact Email */}
        <div className="mb-6">
          <label htmlFor="studentContactEmail" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Student Contact Email <span className="text-red-500">*</span>
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            Please use the seq.org email address. It is the expectation that this person actively checks their school email.
          </p>
          <input
            type="email"
            id="studentContactEmail"
            required
            value={studentContactEmail}
            onChange={(e) => setStudentContactEmail(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
          />
        </div>

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

        {/* Submit Button */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
              Submitting...
            </>
          ) : (
            <>
              <Send className="h-5 w-5" />
              Submit Charter Request
            </>
          )}
        </button>
      </div>
    </form>
  )
}
