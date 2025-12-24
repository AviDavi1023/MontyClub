export interface Club {
  id: string
  name: string
  category: string
  description: string
  advisor: string
  studentLeader: string
  meetingTime: string
  // Free-text meeting frequency (examples: "Weekly", "1st and 3rd weeks of the month", "Once per quarter")
  meetingFrequency?: string
  location: string
  contact: string
  socialMedia: string
  active: boolean
  // Notes are free-text and shown only on the club detail page (dates, announcements, application info, etc.)
  notes?: string
  // Optional short announcement or reminder (displayed prominently on cards/details)
  announcement?: string
  keywords: string[]
}

export interface ClubFilters {
  search: string
  // Allow single or multiple selections for category and meetingDay
  category: string | string[]
  meetingDay: string | string[]
  // Allow filtering by meeting frequency (e.g. 'Weekly', '1st & 3rd weeks')
  meetingFrequency?: string | string[]
  status: string
  // Sorting option: 'relevant' | 'random' | 'az' | 'za'
  sort?: string
}

export interface RegistrationCollection {
  id: string
  name: string
  enabled: boolean
  createdAt: string
  // New: separate concerns
  // display: which collection powers the public catalog (only one should be true)
  display?: boolean
  // accepting: this collection is open for new submissions (can be many)
  accepting?: boolean
}

export interface ClubRegistration {
  id: string
  email: string
  clubName: string
  advisorName: string // "Last Name (First Initial)"
  statementOfPurpose: string
  location: string
  meetingDay: string
  meetingFrequency: string
  studentContactName: string
  studentContactEmail: string
  advisorAgreementDate: string
  clubAgreementDate: string
  submittedAt: string
  status: 'pending' | 'approved' | 'rejected'
  collectionId: string // Reference to RegistrationCollection
  denialReason?: string // Optional reason for rejection
  approvedAt?: string // Timestamp when the registration was approved
  socialMedia?: string // Optional social media handle or link
  category: string // Club category
  notes?: string // Optional public notes
}
