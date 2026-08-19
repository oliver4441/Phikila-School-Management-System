import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { usePlatformSession } from './session'

const STORAGE_KEY = 'phikila.activeSchool'

/** Active school id shared with apiFetch via localStorage (survives reloads). */
export function getActiveSchoolId(): number | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(STORAGE_KEY)
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}

export function storeActiveSchoolId(id: number) {
  window.localStorage.setItem(STORAGE_KEY, String(id))
}

type SchoolContextValue = {
  activeSchoolId: number | null
  activeRole: string | null
  schools: { id: number; name: string; role: string }[]
  setActiveSchool: (id: number) => void
}

const SchoolContext = createContext<SchoolContextValue | null>(null)

/**
 * Tracks which of the caller's schools is active. The active id is persisted
 * and read by apiFetch so every request carries X-School-Id.
 */
export function SchoolProvider({ children }: { children: ReactNode }) {
  const { session } = usePlatformSession()
  const schools = useMemo(() => session?.schools ?? [], [session])
  const [activeSchoolId, setActiveSchoolIdState] = useState<number | null>(() => getActiveSchoolId())

  useEffect(() => {
    if (!session) return
    const stored = getActiveSchoolId()
    const valid = stored != null && schools.some((s) => s.id === stored)
    const next = valid ? stored : (session.active_school_id ?? schools[0]?.id ?? null)
    if (next !== activeSchoolId) setActiveSchoolIdState(next)
    if (next != null) storeActiveSchoolId(next)
  }, [session, schools, activeSchoolId])

  const setActiveSchool = useCallback((id: number) => {
    storeActiveSchoolId(id)
    setActiveSchoolIdState(id)
  }, [])

  const activeRole = useMemo(
    () => schools.find((s) => s.id === activeSchoolId)?.role ?? null,
    [schools, activeSchoolId],
  )

  const value = useMemo(
    () => ({ activeSchoolId, activeRole, schools, setActiveSchool }),
    [activeSchoolId, activeRole, schools, setActiveSchool],
  )

  return <SchoolContext.Provider value={value}>{children}</SchoolContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSchool(): SchoolContextValue {
  const context = useContext(SchoolContext)
  if (!context) throw new Error('useSchool must be used inside <SchoolProvider>')
  return context
}