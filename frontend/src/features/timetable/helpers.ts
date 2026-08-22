import { scheduling, type Calendar } from '../../lib/scheduling'
import type { Bundle } from './types'

export async function loadBundle(): Promise<Bundle> {
  const [calendar, version, teachers, subjects, rooms, classes] = await Promise.all([
    scheduling.calendar(),
    scheduling.currentVersion(),
    scheduling.teachers(),
    scheduling.subjects(),
    scheduling.rooms(),
    scheduling.classes(),
  ])
  const [lessons, conflicts, unassigned] = version
    ? await Promise.all([
        scheduling.lessons(version.id),
        scheduling.conflicts(version.id),
        scheduling.unassigned(version.id),
      ])
    : [[], [], []]
  return { calendar, version, lessons, teachers, subjects, rooms, classes, conflicts, unassigned }
}

/** Which school day/period is happening right now, from the device clock. */
export function computeCurrentSlot(calendar: Calendar | undefined): { day: number; period: number } | null {
  if (!calendar) return null
  const now = new Date()
  const day = (now.getDay() + 6) % 7 // Monday = 0
  const active = calendar.days.filter((d) => d.is_active).map((d) => d.index)
  if (!active.includes(day)) return null
  const minutes = now.getHours() * 60 + now.getMinutes()
  const period = calendar.periods.find((p) => {
    if (!p.is_teaching) return false
    const [startHour, startMin] = p.start_time.split(':').map(Number)
    const [endHour, endMin] = p.end_time.split(':').map(Number)
    const start = startHour * 60 + startMin
    const end = endHour * 60 + endMin
    return minutes >= start && minutes < end
  })
  return period ? { day, period: period.index } : null
}
