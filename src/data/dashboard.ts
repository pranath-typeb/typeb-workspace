export interface CalendarEvent {
  month: string
  day: string
  title: string
  subtitle: string
  kind: 'birthday' | 'holiday'
}

export const upcomingEvents: CalendarEvent[] = [
  { month: 'Jul', day: '14', title: "Aruna Randika's birthday", subtitle: 'Tuesday', kind: 'birthday' },
  { month: 'Jul', day: '17', title: "Randunu Dimeshan's birthday", subtitle: 'Friday', kind: 'birthday' },
  { month: 'Jul', day: '15', title: 'Democracy & National Unity Day', subtitle: 'Holiday in Turkey', kind: 'holiday' },
]

export const whoIsOff = [
  { initials: 'DR', name: 'Dinusha Randika' },
  { initials: 'BA', name: 'Batool Abdullah' },
  { initials: 'CW', name: 'Chamika Wijeratne' },
  { initials: 'AH', name: 'Ashkar Haris' },
  { initials: 'CD', name: 'Charinda Dissanayake' },
  { initials: 'DM', name: 'Devon Marsh' },
  { initials: 'GK', name: 'Grace Kim' },
  { initials: 'VP', name: 'Viktor Petrov' },
]

export const weeklyHoursWorked = '29:30'
export const weeklyHoursTarget = 32
export const weeklyBehindLabel = '3:30 behind target to date'

export interface WeekSummary {
  range: string
  hours: string
  target: number
  onTrack: boolean
}

export const weekSummaries: WeekSummary[] = [
  { range: '25 Aug - 31 Aug', hours: '41:45', target: 40, onTrack: true },
  { range: '1 Sep - 7 Sep', hours: '36:15', target: 40, onTrack: false },
  { range: '8 Sep - 14 Sep', hours: '40:10', target: 40, onTrack: true },
]
