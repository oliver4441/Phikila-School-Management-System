import { useCallback, useEffect, useMemo, useState } from 'react'
import type { LessonMeta } from '../../../components/TimetableGrid'
import { friendlyApiError } from '../../../lib/api'
import { cachedFetch } from '../../../lib/offline'
import { computeCurrentSlot, loadBundle } from '../helpers'
import type { Bundle, Filter } from '../types'

export function useTimetableData() {
  const [bundle, setBundle] = useState<Bundle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stale, setStale] = useState<number | null>(null)
  const [filter, setFilter] = useState<Filter>({ scope: 'all', id: null })
  const [dayFilter, setDayFilter] = useState<number | null>(null)
  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await cachedFetch('timetable:workspace', loadBundle)
      setBundle(result.data)
      setStale(result.stale ? result.savedAt : null)
    } catch (err) {
      setError(friendlyApiError(err, 'load the timetable'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Re-compute the live highlight once a minute so it stays honest.
  const [currentSlot, setCurrentSlot] = useState<{ day: number; period: number } | null>(null)
  useEffect(() => {
    const update = () => setCurrentSlot(computeCurrentSlot(bundle?.calendar))
    update()
    const timer = window.setInterval(update, 60_000)
    return () => window.clearInterval(timer)
  }, [bundle])

  const meta: LessonMeta = useMemo(
    () => ({
      subjects: new Map((bundle?.subjects ?? []).map((s) => [s.id, s])),
      teachers: new Map((bundle?.teachers ?? []).map((t) => [t.id, t])),
      rooms: new Map((bundle?.rooms ?? []).map((r) => [r.id, r])),
      classes: new Map((bundle?.classes ?? []).map((c) => [c.id, c])),
    }),
    [bundle],
  )

  const conflicted = useMemo(() => {
    const ids = new Set<number>()
    for (const conflict of bundle?.conflicts ?? []) {
      if (conflict.severity === 'hard') conflict.lesson_ids.forEach((id) => ids.add(id))
    }
    return ids
  }, [bundle])

  const visible = useMemo(() => {
    const all = bundle?.lessons ?? []
    let result = all
    if (filter.scope !== 'all' && filter.id !== null) {
      const key = { class: 'class_id', teacher: 'teacher_id', room: 'room_id', subject: 'subject_id' }[filter.scope] as
        | 'class_id'
        | 'teacher_id'
        | 'room_id'
        | 'subject_id'
      result = result.filter((lesson) => lesson[key] === filter.id)
    }
    if (dayFilter !== null) {
      result = result.filter((lesson) => lesson.day_index === dayFilter)
    }
    return result
  }, [bundle, filter, dayFilter])

  const hardCount = (bundle?.conflicts ?? []).filter((c) => c.severity === 'hard').length
  const softCount = (bundle?.conflicts ?? []).filter((c) => c.severity === 'soft').length
  const readOnly = bundle?.version?.status === 'published'

  return {
    bundle,
    loading,
    error,
    stale,
    filter,
    setFilter,
    dayFilter,
    setDayFilter,
    load,
    currentSlot,
    meta,
    conflicted,
    visible,
    hardCount,
    softCount,
    readOnly,
  }
}
