'use client'

import { useState } from 'react'
import { Send, CheckCircle } from 'lucide-react'
import { broadcast } from '@/lib/broadcast'
import { getUserFriendlyError } from '@/lib/error-messages'
import { Button, Input, Textarea } from '@/components/ui'

export function SubmitUpdateForm() {
  const [formData, setFormData] = useState({
    clubName: '',
    updateType: '',
    suggestedChange: '',
    contactEmail: '',
    additionalNotes: '',
  })
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const resp = await fetch('/api/updates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!resp.ok) {
        throw new Error('Failed to submit update')
      }
      const entry = await resp.json()

      // Broadcast new update so admin panel can force a fresh fetch
      broadcast('updates', 'create', entry)

      setIsSubmitted(true)
    } catch (error) {
      console.error('Error submitting update:', error)
      setError(getUserFriendlyError(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  if (isSubmitted) {
    return (
      <div className="card text-center">
        <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
          Thank You!
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Your update request has been submitted. We'll review it and make the necessary changes.
        </p>
        <Button
          variant="primary"
          onClick={() => {
            setIsSubmitted(false)
            setFormData({
              clubName: '',
              updateType: '',
              suggestedChange: '',
              contactEmail: '',
              additionalNotes: '',
            })
          }}
        >
          Submit Another Update
        </Button>
      </div>
    )
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="card space-y-6">
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-700 dark:text-red-200">{error}</p>
          </div>
        )}

        <Input
        label="Club Name"
        id="clubName"
        name="clubName"
        type="text"
        value={formData.clubName}
        onChange={handleChange}
        required
        placeholder="Enter the name of the club"
      />

      <div>
        <label htmlFor="updateType" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Type of Update *
        </label>
        <select
          id="updateType"
          name="updateType"
          value={formData.updateType}
          onChange={handleChange}
          required
          className="input-field"
        >
          <option value="">Select update type</option>
          <option value="info-correction">Information Correction</option>
          <option value="name-change">Club Name Change</option>
          <option value="meeting-time">Meeting Time Change</option>
          <option value="meeting-frequency">Meeting Frequency Change</option>
          <option value="location-change">Location Change</option>
          <option value="contact-update">Contact Information Update</option>
          <option value="advisor-change">Advisor Change</option>
          <option value="status-change">Status Change (Open/Closed)</option>
          <option value="new-club">New Club Addition</option>
          <option value="other">Other</option>
        </select>
      </div>

      <Textarea
        label="Suggested Change"
        id="suggestedChange"
        name="suggestedChange"
        value={formData.suggestedChange}
        onChange={handleChange}
        required
        rows={3}
        placeholder="Describe the change you'd like to see"
      />

      <Input
        label="Your Email"
        id="contactEmail"
        name="contactEmail"
        type="email"
        value={formData.contactEmail}
        onChange={handleChange}
        required
        placeholder="your.email@school.edu"
      />

      <Textarea
        label="Additional Notes"
        id="additionalNotes"
        name="additionalNotes"
        value={formData.additionalNotes}
        onChange={handleChange}
        rows={3}
        placeholder="Any additional information or context"
      />

      <div className="pt-4">
        <Button
          type="submit"
          variant="primary"
          disabled={isSubmitting}
          isLoading={isSubmitting}
          className="w-full"
          icon={isSubmitting ? undefined : <Send className="h-4 w-4" />}
        >
          {isSubmitting ? 'Submitting...' : 'Submit Update'}
        </Button>
      </div>

      {/* Removed demo note — now submits to backend API */}
    </form>
    </>
  )
}


