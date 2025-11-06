'use client'

import { useState } from 'react'
import { Send, CheckCircle } from 'lucide-react'

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

      setIsSubmitted(true)
    } catch (error) {
      console.error('Error submitting update:', error)
      alert('There was an error submitting your update. Please try again.')
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
        <button
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
          className="btn-primary"
        >
          Submit Another Update
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-6">
      <div>
        <label htmlFor="clubName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Club Name *
        </label>
        <input
          type="text"
          id="clubName"
          name="clubName"
          value={formData.clubName}
          onChange={handleChange}
          required
          className="input-field"
          placeholder="Enter the name of the club"
        />
      </div>

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

      <div>
        <label htmlFor="suggestedChange" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Suggested Change *
        </label>
        <textarea
          id="suggestedChange"
          name="suggestedChange"
          value={formData.suggestedChange}
          onChange={handleChange}
          required
          rows={3}
          className="input-field"
          placeholder="Describe the change you'd like to see"
        />
      </div>

      <div>
        <label htmlFor="contactEmail" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Your Email *
        </label>
        <input
          type="email"
          id="contactEmail"
          name="contactEmail"
          value={formData.contactEmail}
          onChange={handleChange}
          required
          className="input-field"
          placeholder="your.email@school.edu"
        />
      </div>

      <div>
        <label htmlFor="additionalNotes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Additional Notes
        </label>
        <textarea
          id="additionalNotes"
          name="additionalNotes"
          value={formData.additionalNotes}
          onChange={handleChange}
          rows={3}
          className="input-field"
          placeholder="Any additional information or context"
        />
      </div>

      <div className="pt-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Submitting...
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Submit Update Request
            </>
          )}
        </button>
      </div>

      {/* Removed demo note — now submits to backend API */}
    </form>
  )
}
