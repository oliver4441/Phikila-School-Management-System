import { useEffect, useState } from 'react'
import { ApiError, friendlyApiError } from '../../../lib/api'
import { useToast } from '../../../components/Toast'
import {
  scheduling,
  type Alternative,
  type Explanation,
  type Lesson,
} from '../../../lib/scheduling'
import type { Bundle, HistoryEntry } from '../types'

type Params = {
  bundle: Bundle | null
  readOnly: boolean
  load: () => Promise<void>
}

export function useTimetableActions({ bundle, readOnly, load }: Params) {
  const { notify } = useToast()

  const [selected, setSelected] = useState<Lesson | null>(null)
  const [explanation, setExplanation] = useState<Explanation | null>(null)
  const [busy, setBusy] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [confirmPublish, setConfirmPublish] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState<Lesson | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [paletteOpen, setPaletteOpen] = useState(false)

  function pushHistory(lessonId: number, before: { day_index: number; period_index: number }, after: { day_index: number; period_index: number }) {
    setHistory((current) => [...current.slice(0, historyIndex + 1), { lessonId, before, after }])
    setHistoryIndex((index) => index + 1)
  }

  async function applyUndoRedo(
    entry: HistoryEntry,
    direction: 'undo' | 'redo',
  ) {
    const target = direction === 'undo' ? entry.before : entry.after
    try {
      await scheduling.moveLesson(entry.lessonId, target)
      await load()
      notify(direction === 'undo' ? 'Move undone.' : 'Move redone.', 'success')
    } catch (err) {
      notify(friendlyApiError(err, 'undo that move'), 'error')
    }
  }

  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      const target = event.target as HTMLElement | null
      const typing = target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
      const mod = event.metaKey || event.ctrlKey
      if (typing && !mod) return

      if (mod && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) {
          if (historyIndex < history.length - 1) {
            const entry = history[historyIndex + 1]
            setHistoryIndex((index) => index + 1)
            void applyUndoRedo(entry, 'redo')
          }
        } else if (historyIndex >= 0) {
          const entry = history[historyIndex]
          setHistoryIndex((index) => index - 1)
          void applyUndoRedo(entry, 'undo')
        }
        return
      }
      if (mod && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen(true)
        return
      }
      if (!typing && (event.key === 'Delete' || event.key === 'Backspace') && selected && !readOnly) {
        event.preventDefault()
        setConfirmingDelete(selected)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history, historyIndex, selected, readOnly])

  async function handleMove(lesson: Lesson, day: number, period: number) {
    if (busy) return
    setBusy(true)
    setExplanation(null)
    const before = { day_index: lesson.day_index, period_index: lesson.period_index }
    try {
      await scheduling.moveLesson(lesson.id, { day_index: day, period_index: period })
      pushHistory(lesson.id, before, { day_index: day, period_index: period })
      notify('Lesson moved.', 'success')
      await load()
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && err.detail) {
        const detail = err.detail as { reasons?: Explanation['reasons']; alternatives?: Alternative[] }
        setSelected(lesson)
        setExplanation({
          allowed: false,
          reasons: detail.reasons ?? [],
          alternatives: detail.alternatives ?? [],
        })
        notify('That move creates a conflict.', 'error')
      } else {
        notify(friendlyApiError(err, 'move the lesson'), 'error')
      }
    } finally {
      setBusy(false)
    }
  }

  async function handleResize(lesson: Lesson, duration: number) {
    try {
      await scheduling.patchLesson(lesson.id, { duration })
      notify(`Duration changed to ${duration} ${duration === 1 ? 'period' : 'periods'}.`, 'success')
      await load()
    } catch (err) {
      showConflict(err, 'change the duration', lesson)
    }
  }

  function showConflict(err: unknown, action: string, lesson: Lesson) {
    if (err instanceof ApiError && err.status === 409 && err.detail) {
      const detail = err.detail as { reasons?: Explanation['reasons']; alternatives?: Alternative[] }
      setSelected(lesson)
      setExplanation({ allowed: false, reasons: detail.reasons ?? [], alternatives: detail.alternatives ?? [] })
      notify(`That change to ${action} creates a conflict.`, 'error')
    } else {
      notify(friendlyApiError(err, action), 'error')
    }
  }

  async function handlePatch(lesson: Lesson, patch: Parameters<typeof scheduling.patchLesson>[1], success: string) {
    if (busy) return
    setBusy(true)
    setExplanation(null)
    try {
      const updated = await scheduling.patchLesson(lesson.id, patch)
      setSelected(updated)
      notify(success, 'success')
      await load()
    } catch (err) {
      showConflict(err, success, lesson)
    } finally {
      setBusy(false)
    }
  }

  async function handleDropUnassigned(requirementId: number, day: number, period: number) {
    if (!bundle?.version || readOnly) return
    const item = bundle.unassigned.find((u) => u.requirement_id === requirementId)
    try {
      await scheduling.createLesson(bundle.version.id, { requirement_id: requirementId, day_index: day, period_index: period })
      notify(
        item ? `${item.subject_name} for ${item.class_name} scheduled.` : 'Lesson scheduled.',
        'success',
      )
      await load()
    } catch (err) {
      notify(friendlyApiError(err, 'schedule that lesson'), 'error')
    }
  }

  async function handleDuplicate() {
    if (!selected) return
    try {
      await scheduling.duplicateLesson(selected.id)
      notify('Lesson duplicated. Drag the copy where you need it.', 'success')
      await load()
    } catch (err) {
      notify(friendlyApiError(err, 'duplicate the lesson'), 'error')
    }
  }

  async function handleDelete() {
    if (!confirmingDelete) return
    const target = confirmingDelete
    setConfirmingDelete(null)
    try {
      await scheduling.deleteLesson(target.id)
      if (selected?.id === target.id) {
        setSelected(null)
        setExplanation(null)
      }
      notify('Lesson deleted.', 'success')
      await load()
    } catch (err) {
      notify(friendlyApiError(err, 'delete the lesson'), 'error')
    }
  }

  async function handleAssignRooms() {
    if (!bundle?.version) return
    try {
      const result = await scheduling.assignRooms(bundle.version.id)
      notify(`Assigned rooms to ${result.assigned} lessons.`, 'success')
      await load()
    } catch (err) {
      notify(friendlyApiError(err, 'assign rooms'), 'error')
    }
  }

  async function askWhy(lesson: Lesson, day: number, period: number) {
    try {
      setExplanation(await scheduling.explain(lesson.id, day, period))
    } catch (err) {
      notify(friendlyApiError(err, 'explain that slot'), 'error')
    }
  }

  async function applyAlternative(alt: Alternative) {
    if (!selected) return
    await handleMove(selected, alt.day, alt.period)
  }

  async function handlePublish() {
    if (!bundle?.version || publishing) return
    setPublishing(true)
    setConfirmPublish(false)
    try {
      await scheduling.publish(bundle.version.id)
      notify('Timetable published.', 'success')
      await load()
    } catch (err) {
      notify(friendlyApiError(err, 'publish the timetable'), 'error')
    } finally {
      setPublishing(false)
    }
  }

  return {
    selected,
    setSelected,
    explanation,
    setExplanation,
    busy,
    publishing,
    confirmPublish,
    setConfirmPublish,
    confirmingDelete,
    setConfirmingDelete,
    paletteOpen,
    setPaletteOpen,
    handleMove,
    handleResize,
    handlePatch,
    handleDropUnassigned,
    handleDuplicate,
    handleDelete,
    handleAssignRooms,
    askWhy,
    applyAlternative,
    handlePublish,
  }
}
