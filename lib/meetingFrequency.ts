// Small helper to normalize/format meeting frequency strings for display
export function formatMeetingFrequency(freq?: string) {
  if (!freq) return ''
  const s = String(freq).trim()

  // Common normalizations
  const lower = s.toLowerCase()
  if (lower === 'weekly' || lower === 'weekly meetings' || lower === 'every week') return 'Weekly'
  if (lower.includes('1st') && lower.includes('3rd')) return '1st & 3rd weeks'
  if (lower.includes('2nd') && lower.includes('4th')) return '2nd & 4th weeks'
  if (lower.includes('1st') && lower.includes('2nd')) return '1st & 2nd weeks'
  if (lower.includes('once') && lower.includes('quarter')) return 'Once per quarter'
  if (lower.includes('4th') && !lower.includes('1st') && !lower.includes('2nd') && !lower.includes('3rd')) return '4th week only'
  if (lower.includes('3rd') && !lower.includes('1st') && !lower.includes('2nd') && !lower.includes('4th')) return '3rd week only'

  // Title-case simple strings, otherwise return as-is trimmed
  return s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

export default formatMeetingFrequency

// Parse weekday names from a free-text meeting time string. Returns normalized weekday names
export function parseMeetingDays(meetingTime?: string): string[] {
  if (!meetingTime) return []
  const s = String(meetingTime).toLowerCase()
  const days = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
  const found: string[] = []
  for (const d of days) {
    if (s.includes(d) || s.includes(d + 's')) {
      // Title-case for display
      found.push(d.charAt(0).toUpperCase() + d.slice(1))
    }
  }
  return found
}
