import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useRouter } from '../../lib/router'
import { displayName, useAuth } from '../../lib/auth'
import { usePlatformSession } from '../../lib/session'
import { useSchool } from '../../lib/schoolContext'
import { useToast } from '../Toast'
import { PrintFooter } from '../PrintFooter'
import { AiChatWidget } from '../AiChatWidget'
import { CommandPalette, useCommandPaletteShortcut, type PaletteItem } from '../CommandPalette'
import {
  NAV,
  BOTTOM_NAV,
  PLATFORM_NAV,
  routesForRole,
} from './navConfig'
import { AccountBlock, DesktopSidebar, SidebarNav } from './Sidebar'
import { MobileDrawer } from './MobileDrawer'
import { Topbar } from './Topbar'
import { BottomNav } from './BottomNav'

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useRouter()
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const { notify } = useToast()
  const { session: platformSession } = usePlatformSession()
  const isSuperAdmin = platformSession?.is_super_admin ?? false
  const { activeSchoolId, activeRole, schools, setActiveSchool } = useSchool()
  const allowed = routesForRole(activeRole ?? platformSession?.schools[0]?.role ?? 'student', isSuperAdmin)
  const baseGroups = isSuperAdmin ? [PLATFORM_NAV, ...NAV] : NAV
  const groups = allowed
    ? baseGroups
        .map((group) => ({ ...group, items: group.items.filter((item) => allowed.has(item.to)) }))
        .filter((group) => group.items.length > 0)
    : baseGroups
  const bottomNav = allowed ? BOTTOM_NAV.filter((item) => allowed.has(item.to)) : BOTTOM_NAV
  const accountName = displayName(user)
  const accountInitial = accountName.trim().charAt(0).toUpperCase() || 'P'
  const activeSchool = schools.find((s) => s.id === activeSchoolId)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [offline, setOffline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine === false : false,
  )
  const menuButtonRef = useRef<HTMLButtonElement | null>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const togglePalette = useCallback(() => setPaletteOpen((v) => !v), [])
  useCommandPaletteShortcut(togglePalette)

  // Flat list of all visible nav items for the command palette
  const paletteItems: PaletteItem[] = useMemo(() => {
    const allGroups = isSuperAdmin ? [PLATFORM_NAV, ...NAV] : NAV
    const flat: PaletteItem[] = []
    for (const group of allGroups) {
      if (allowed && !group.items.some((i) => allowed.has(i.to))) continue
      for (const item of group.items) {
        if (allowed && !allowed.has(item.to)) continue
        flat.push({ to: item.to, label: item.label, group: group.label, icon: item.icon })
      }
    }
    return flat
  }, [isSuperAdmin, allowed])

  useEffect(() => {
    setDrawerOpen(false)
  }, [pathname])

  useEffect(() => {
    const goOnline = () => setOffline(false)
    const goOffline = () => setOffline(true)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  async function handleSignOut() {
    if (signingOut) return
    setSigningOut(true)
    const result = await signOut()
    setSigningOut(false)
    if (!result.ok) {
      notify(result.message, 'error')
      return
    }
    notify('You have been signed out.', 'success')
    navigate('/login?notice=signed-out', { replace: true })
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      <aside className="sidebar sidebar--desktop">
        <DesktopSidebar activeSchoolName={activeSchool?.name}>
          <SidebarNav groups={groups} pathname={pathname} onSearchClick={togglePalette} />
          <AccountBlock
            accountName={accountName}
            accountInitial={accountInitial}
            email={user?.email}
            signingOut={signingOut}
            onSignOut={handleSignOut}
          />
        </DesktopSidebar>
      </aside>

      <div className="app-shell__main">
        <Topbar
          menuButtonRef={menuButtonRef}
          drawerOpen={drawerOpen}
          onOpenDrawer={() => setDrawerOpen(true)}
          offline={offline}
          schools={schools}
          activeSchoolId={activeSchoolId}
          activeSchoolName={activeSchool?.name}
          onSelectSchool={setActiveSchool}
          email={user?.email}
          accountInitial={accountInitial}
        />

        <MobileDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          menuButtonRef={menuButtonRef}
          groups={groups}
          pathname={pathname}
          onSearchClick={togglePalette}
          accountName={accountName}
          accountInitial={accountInitial}
          email={user?.email}
          signingOut={signingOut}
          onSignOut={handleSignOut}
        />

        <main className="app-shell__content" id="main-content">
          {children}
        </main>

        <BottomNav items={bottomNav} pathname={pathname} />

        <PrintFooter />
      </div>

      <AiChatWidget />

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        items={paletteItems}
      />
    </div>
  )
}
