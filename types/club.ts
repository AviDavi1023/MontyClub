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
  gradeLevel: string
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
  gradeLevel: string
}
