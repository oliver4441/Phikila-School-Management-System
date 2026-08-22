import type {
  Calendar,
  Conflict,
  Lesson,
  Room,
  SchoolClass,
  Subject,
  Teacher,
  Unassigned,
  Version,
} from '../../lib/scheduling'

export type Bundle = {
  calendar: Calendar
  version: Version | null
  lessons: Lesson[]
  teachers: Teacher[]
  subjects: Subject[]
  rooms: Room[]
  classes: SchoolClass[]
  conflicts: Conflict[]
  unassigned: Unassigned[]
}

export type Scope = 'all' | 'class' | 'teacher' | 'room' | 'subject'
export type Filter = { scope: Scope; id: number | null }

export type HistoryEntry = {
  lessonId: number
  before: { day_index: number; period_index: number }
  after: { day_index: number; period_index: number }
}
