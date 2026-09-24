export interface WorkTask {
  title: string
  tag: string
}

export interface ProjectWork {
  project: string
  tasksInProgress: number
  tasks: WorkTask[]
}

export const recentWorks: ProjectWork[] = [
  {
    project: 'Investera',
    tasksInProgress: 3,
    tasks: [
      { title: 'Homepage hero section redesign', tag: 'UI/UX Design' },
      { title: 'Checkout payment flow', tag: 'Research' },
      { title: 'User profile settings page', tag: 'UI/UX Design' },
      { title: 'Daily Sync', tag: 'Meeting' },
    ],
  },
  {
    project: 'Meridian',
    tasksInProgress: 2,
    tasks: [
      { title: 'Landing page illustration set', tag: 'UI/UX Design' },
      { title: 'Mobile onboarding screens', tag: 'UI/UX Design' },
    ],
  },
]

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
]

export const weekDays = [
  { label: 'MON', date: '05', worked: true },
  { label: 'TUE', date: '06', worked: true },
  { label: 'WED', date: '07', worked: true },
  { label: 'THU', date: '08', worked: true },
  { label: 'FRI', date: '09', worked: false, today: true },
  { label: 'SAT', date: '10', worked: false },
  { label: 'SUN', date: '11', worked: false },
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
