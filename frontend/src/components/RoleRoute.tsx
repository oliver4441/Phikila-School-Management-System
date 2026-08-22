import { useEffect, ReactNode } from 'react'
import { usePlatformSession } from '../lib/session'
import { useNavigate } from '../lib/router'
import { FullPageLoader } from './States'
import { useSchool } from '../lib/schoolContext'

export function RoleRoute({ allowed, children }: { allowed: string[]; children: ReactNode }) {
  const { session, loading } = usePlatformSession()
  const { activeRole } = useSchool()
  const navigate = useNavigate()

  const role = session?.is_super_admin 
    ? 'super_admin' 
    : (activeRole ?? session?.schools[0]?.role ?? 'student')
    
  const hasAccess = allowed.includes(role) || 
    (session?.is_super_admin && (allowed.includes('super_admin') || allowed.includes('admin')))

  useEffect(() => {
    if (loading || !session) return

    if (!hasAccess) {
      navigate('/', { replace: true })
    }
  }, [loading, session, hasAccess, navigate])

  if (loading) {
    return <FullPageLoader label="Checking permissions…" />
  }

  if (session && !hasAccess) {
    return null
  }

  return <>{children}</>
}
