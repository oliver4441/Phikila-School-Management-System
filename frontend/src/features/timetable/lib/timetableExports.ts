import type { LessonMeta } from '../../../components/TimetableGrid'
import { activeDays, type Lesson } from '../../../lib/scheduling'
import { DAY_NAMES } from '../constants'
import type { Bundle } from '../types'

export function exportCsv(bundle: Bundle, visible: Lesson[], meta: LessonMeta) {
  const rows = [
    ['Day', 'Period', 'Start', 'Subject', 'Class', 'Teacher', 'Room', 'Duration', 'Locked'],
    ...visible.map((lesson) => {
      const period = bundle.calendar.periods.find((p) => p.index === lesson.period_index)
      return [
        DAY_NAMES[lesson.day_index] ?? lesson.day_index,
        period?.name ?? lesson.period_index,
        period?.start_time ?? '',
        meta.subjects.get(lesson.subject_id)?.name ?? '',
        meta.classes.get(lesson.class_id)?.name ?? '',
        lesson.teacher_id ? (meta.teachers.get(lesson.teacher_id)?.name ?? '') : '',
        lesson.room_id ? (meta.rooms.get(lesson.room_id)?.name ?? '') : '',
        String(lesson.duration),
        lesson.is_locked ? 'yes' : 'no',
      ]
    }),
  ]
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
    .join('\n')
  downloadText(csv, 'timetable.csv', 'text/csv')
}

export function exportIcs(bundle: Bundle, visible: Lesson[], meta: LessonMeta) {
  // Anchor to the current week's Monday so the file opens in any calendar.
  const nowDate = new Date()
  const monday = new Date(nowDate)
  monday.setDate(nowDate.getDate() - ((nowDate.getDay() + 6) % 7))
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Phikila School Management System//Timetable//EN',
    'X-WR-CALNAME:School Timetable',
  ]
  const fmt = (d: Date) =>
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}00`
  for (const lesson of visible) {
    const period = bundle.calendar.periods.find((p) => p.index === lesson.period_index)
    if (!period) continue
    const end = bundle.calendar.periods.find(
      (p) => p.index === lesson.period_index + (lesson.duration ?? 1) - 1,
    )
    const startDate = new Date(monday)
    startDate.setDate(monday.getDate() + lesson.day_index)
    const [sh, sm] = period.start_time.split(':').map(Number)
    startDate.setHours(sh, sm, 0, 0)
    const endDate = new Date(startDate)
    const [eh, em] = (end?.end_time ?? period.end_time).split(':').map(Number)
    endDate.setHours(eh, em, 0, 0)
    const summary = `${meta.subjects.get(lesson.subject_id)?.name ?? 'Lesson'} — ${meta.classes.get(lesson.class_id)?.name ?? ''}`
    lines.push(
      'BEGIN:VEVENT',
      `UID:phikila-lesson-${lesson.id}@phikila`,
      `DTSTART:${fmt(startDate)}`,
      `DTEND:${fmt(endDate)}`,
      `SUMMARY:${summary}`,
      `LOCATION:${lesson.room_id ? (meta.rooms.get(lesson.room_id)?.name ?? '') : 'No room'}`,
      `DESCRIPTION:${lesson.teacher_id ? (meta.teachers.get(lesson.teacher_id)?.name ?? '') : 'Unassigned'}`,
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  downloadText(lines.join('\r\n'), 'timetable.ics', 'text/calendar')
}

export function exportPng(bundle: Bundle, visible: Lesson[], meta: LessonMeta) {
  const days = activeDays(bundle.calendar.days)
  const teaching = bundle.calendar.periods.filter((p) => p.is_teaching)
  const cellW = 170
  const cellH = 64
  const timeW = 90
  const headH = 40
  const canvas = document.createElement('canvas')
  canvas.width = timeW + days.length * cellW
  canvas.height = headH + teaching.length * cellH
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#0F2A47'
  ctx.font = '600 15px system-ui, sans-serif'
  days.forEach((day, index) => {
    ctx.fillText(day.name, timeW + index * cellW + 10, 26)
  })
  const bySlot = new Map<string, Lesson[]>()
  for (const lesson of visible) {
    const key = `${lesson.day_index}:${lesson.period_index}`
    const bucket = bySlot.get(key)
    if (bucket) bucket.push(lesson)
    else bySlot.set(key, [lesson])
  }
  teaching.forEach((period, row) => {
    const y = headH + row * cellH
    ctx.fillStyle = '#33475B'
    ctx.font = '500 12px system-ui, sans-serif'
    ctx.fillText(`${period.name} ${period.start_time}`, 8, y + 24)
    ctx.strokeStyle = '#E4EAF0'
    ctx.strokeRect(0, y, canvas.width, cellH)
    days.forEach((day, col) => {
      const cell = bySlot.get(`${day.index}:${period.index}`) ?? []
      const x = timeW + col * cellW
      ctx.strokeStyle = '#E4EAF0'
      ctx.strokeRect(x, y, cellW, cellH)
      cell.forEach((lesson, index) => {
        const subject = meta.subjects.get(lesson.subject_id)
        ctx.fillStyle = subject?.colour ?? '#0F2A47'
        ctx.fillRect(x + 4, y + 6 + index * 24, cellW - 8, 20)
        ctx.fillStyle = '#ffffff'
        ctx.font = '600 11px system-ui, sans-serif'
        ctx.fillText(
          `${subject?.name ?? 'Lesson'} · ${meta.classes.get(lesson.class_id)?.name ?? ''}`,
          x + 10,
          y + 20 + index * 24,
        )
      })
    })
  })
  canvas.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'timetable.png'
    anchor.click()
    URL.revokeObjectURL(url)
  }, 'image/png')
}

function downloadText(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
