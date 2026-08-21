import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, normalisePath, useNavigate, useRouter } from '../lib/router'
import { displayName, useAuth } from '../lib/auth'
import { usePlatformSession } from '../lib/session'
import { useSchool } from '../lib/schoolContext'
import { useTheme } from '../lib/theme'
import { useToast } from './Toast'
import { Logo, LogoMark } from './Logo'
import { PrintFooter } from './PrintFooter'
import { AiChatWidget } from './AiChatWidget'
import { CommandPalette, useCommandPaletteShortcut, type PaletteItem } from './CommandPalette'
import {
  CalendarIcon,
  CheckIcon,
  CloseIcon,
  DashboardIcon,
  GridIcon,
  InboxIcon,
  LayersIcon,
  LogOutIcon,
  MenuIcon,
  MoonIcon,
  SchoolIcon,
  SearchIcon,
  SparkIcon,
  SunIcon,
  UserIcon,
} from './icons'

type NavItem = { to: string; label: string; icon?: ReactNode }
type NavGroup = { label: string; items: NavItem[] }

const PLATFORM_NAV: NavGroup = {
  label: 'Platform',
  items: [
    { to: '/platform', label: 'Platform dashboard', icon: <DashboardIcon /> },
    { to: '/platform/schools', label: 'Schools', icon: <SchoolIcon /> },
    { to: '/platform/requests', label: 'Access requests', icon: <InboxIcon /> },
    { to: '/platform/admins', label: 'Administrators', icon: <UserIcon /> },
    { to: '/platform/audit', label: 'Audit trail', icon: <LayersIcon /> },
    { to: '/settings/ai-providers', label: 'AI providers', icon: <SparkIcon /> },
    { to: '/settings/ai', label: 'AI Configuration', icon: <SparkIcon /> },
  ],
}

/** New grouped navigation per the Product Upgrade Plan §12 */
const NAV: NavGroup[] = [
  {
    label: 'Home',
    items: [
      { to: '/', label: 'Dashboard', icon: <DashboardIcon /> },
      { to: '/notifications', label: 'Notifications', icon: <InboxIcon /> },
      { to: '/tasks', label: 'Tasks', icon: <CheckIcon /> },
    ],
  },
  {
    label: 'School',
    items: [
      { to: '/students', label: 'Students', icon: <UserIcon /> },
      { to: '/setup/teachers', label: 'Teachers', icon: <UserIcon /> },
      { to: '/setup/classes', label: 'Classes', icon: <SchoolIcon /> },
      { to: '/parents', label: 'Parents / Guardians', icon: <UserIcon /> },
      { to: '/admissions', label: 'Admissions', icon: <InboxIcon /> },
    ],
  },
  {
    label: 'Academics',
    items: [
      { to: '/setup/subjects', label: 'Subjects', icon: <LayersIcon /> },
      { to: '/examinations', label: 'Examinations', icon: <LayersIcon /> },
      { to: '/results', label: 'Results', icon: <CheckIcon /> },
      { to: '/reports', label: 'Reports', icon: <LayersIcon /> },
    ],
  },
  {
    label: 'Attendance',
    items: [
      { to: '/attendance', label: 'Take attendance', icon: <CheckIcon /> },
      { to: '/attendance/records', label: 'Attendance records', icon: <CalendarIcon /> },
    ],
  },
  {
    label: 'Finance',
    items: [
      { to: '/finance', label: 'Overview', icon: <GridIcon /> },
      { to: '/finance/payment-inbox', label: 'Payments', icon: <InboxIcon /> },
      { to: '/finance/treasury', label: 'Treasury', icon: <GridIcon /> },
    ],
  },
  {
    label: 'Timetable',
    items: [
      { to: '/timetable', label: 'Timetable', icon: <CalendarIcon /> },
      { to: '/scheduling/requirements', label: 'Requirements', icon: <LayersIcon /> },
      { to: '/scheduling/constraints', label: 'Constraints', icon: <CheckIcon /> },
      { to: '/scheduling/generate', label: 'Generate', icon: <SparkIcon /> },
      { to: '/versions', label: 'Versions', icon: <LayersIcon /> },
      { to: '/analytics', label: 'Analytics', icon: <LayersIcon /> },
    ],
  },
  {
    label: 'Administration',
    items: [
      { to: '/setup/school', label: 'School profile', icon: <SchoolIcon /> },
      { to: '/setup/academic-years', label: 'Academic year', icon: <CalendarIcon /> },
      { to: '/setup/periods', label: 'Days & periods', icon: <CalendarIcon /> },
      { to: '/setup/rooms', label: 'Rooms', icon: <GridIcon /> },
      { to: '/setup/levels', label: 'Levels', icon: <LayersIcon /> },
    ],
  },
  {
    label: 'AI',
    items: [
      { to: '/scheduling/copilot', label: 'Copilot', icon: <SparkIcon /> },
      { to: '/ocr', label: 'Document Scanner', icon: <LayersIcon /> },
    ],
  },
  {
    label: 'Operations',
    items: [
      { to: '/health', label: 'Health & welfare', icon: <CheckIcon /> },
      { to: '/inventory', label: 'Inventory', icon: <GridIcon /> },
      { to: '/library', label: 'Library', icon: <LayersIcon /> },
      { to: '/board', label: 'Board', icon: <SchoolIcon /> },
      { to: '/principal', label: 'Principal', icon: <UserIcon /> },
    ],
  },
]

const BOTTOM_NAV: NavItem[] = [
  { to: '/', label: 'Home', icon: <DashboardIcon /> },
  { to: '/attendance', label: 'Attendance', icon: <CheckIcon /> },
  { to: '/timetable', label: 'Timetable', icon: <CalendarIcon /> },
  { to: '/finance', label: 'Finance', icon: <GridIcon /> },
  { to: '/students', label: 'Students', icon: <UserIcon /> },
]

function isActive(pathname: string, to: string) {
  const current = normalisePath(pathname)
  if (to === '/') return current === '/'
  return current === to || current.startsWith(`${to}/`)
}

/** Routes visible to each school membership role (admin/superadmin see all). */
const ROLE_ALLOWED_ROUTES: Record<string, string[]> = {
  admin: [
    '/', '/notifications', '/tasks',
    '/students', '/setup/teachers', '/setup/classes', '/parents', '/admissions',
    '/setup/subjects', '/examinations', '/results', '/reports',
    '/attendance', '/attendance/records',
    '/finance', '/finance/payment-inbox', '/finance/treasury',
    '/timetable', '/scheduling/requirements', '/scheduling/constraints', '/scheduling/generate', '/versions', '/analytics',
    '/setup/school', '/setup/academic-years', '/setup/periods', '/setup/rooms', '/setup/levels',
    '/scheduling/copilot', '/ocr',
    '/health', '/inventory', '/library', '/board', '/principal',
    '/profile',
  ],
  academics: [
    '/', '/notifications', '/tasks',
    '/students', '/setup/teachers', '/setup/classes', '/parents', '/admissions',
    '/setup/subjects', '/examinations', '/results', '/reports',
    '/attendance', '/attendance/records',
    '/timetable', '/scheduling/requirements', '/scheduling/constraints', '/scheduling/generate', '/versions', '/analytics',
    '/setup/school', '/setup/academic-years', '/setup/periods', '/setup/rooms', '/setup/levels',
    '/scheduling/copilot', '/ocr',
    '/health', '/inventory', '/library', '/board', '/principal',
    '/profile',
  ],
  finance: [
    '/', '/notifications', '/tasks',
    '/finance', '/finance/payment-inbox', '/finance/treasury',
    '/students',
    '/ocr', '/analytics', '/versions', '/profile',
  ],
  teacher: [
    '/', '/notifications', '/tasks',
    '/attendance', '/attendance/records',
    '/timetable', '/my-timetable',
    '/examinations', '/results',
    '/ocr', '/analytics', '/versions', '/profile',
  ],
  student: ['/', '/my-timetable', '/profile'],
  parent: ['/', '/my-timetable', '/profile'],
}

function routesForRole(role: string | null, isSuperAdmin: boolean): Set<string> | null {
  if (isSuperAdmin || role === 'admin') return null
  return new Set(ROLE_ALLOWED_ROUTES[role ?? 'student'] ?? ROLE_ALLOWED_ROUTES.student)
}

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
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    typeof window !== 'undefined' && window.localStorage.getItem('phikila.theme') === 'dark'
      ? 'dark'
      : 'light',
  )
  const drawerRef = useRef<HTMLElement | null>(null)
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
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem('phikila.theme', theme)
  }, [theme])

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

  useEffect(() => {
    if (!drawerOpen) return

    document.body.classList.add('body--locked')
    const firstLink = drawerRef.current?.querySelector<HTMLElement>('a, button')
    firstLink?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setDrawerOpen(false)
        menuButtonRef.current?.focus()
        return
      }
      if (event.key !== 'Tab' || !drawerRef.current) return

      const focusable = Array.from(
        drawerRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'),
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.classList.remove('body--locked')
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [drawerOpen])

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

  const navigation = (
    <nav className="sidebar__nav" aria-label="Main">
      <div className="sidebar__search-hint" role="button" tabIndex={0} aria-label="Search (Ctrl+K)" onClick={togglePalette} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePalette() } }}>
        <SearchIcon width={16} height={16} />
        <span>Search…</span>
        <kbd>⌘K</kbd>
      </div>
      {groups.map((group) => (
        <div className="sidebar__group" key={group.label}>
          <p className="sidebar__group-label">{group.label}</p>
          <ul className="sidebar__list">
            {group.items.map((item) => {
              const active = isActive(pathname, item.to)
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className={`sidebar__link ${active ? 'sidebar__link--active' : ''}`.trim()}
                    aria-current={active ? 'page' : undefined}
                  >
                    {item.icon && (
                      <span className="sidebar__icon" aria-hidden="true">
                        {item.icon}
                      </span>
                    )}
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )

  const { theme, cycle: cycleTheme } = useTheme()

  const accountBlock = (
    <div className="sidebar__account">
      <div className="sidebar__account-profile">
        <span className="sidebar__account-avatar" aria-hidden="true">{accountInitial}</span>
        <div>
          <p className="sidebar__account-name" title={accountName}>{accountName}</p>
          <p className="sidebar__account-email">{user?.email}</p>
        </div>
      </div>
      <div className="sidebar__account-actions">
        <button
          type="button"
          className="icon-button icon-button--subtle"
          onClick={cycleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : theme === 'light' ? 'Switch to dark mode' : 'Switch to system mode'}
          aria-label={theme === 'dark' ? 'Switch to light mode' : theme === 'light' ? 'Switch to dark mode' : 'Switch to system mode'}
        >
          {theme === 'dark' ? <SunIcon width={18} height={18} /> : <MoonIcon width={18} height={18} />}
        </button>
        <button
          type="button"
          className="button button--ghost button--block"
          onClick={handleSignOut}
          disabled={signingOut}
        >
          <LogOutIcon width={18} height={18} />
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </div>
  )

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      <aside className="sidebar sidebar--desktop">
        <div className="sidebar__brand">
          <Logo size={34} tone="dark" />
          {activeSchool && (
            <div className="sidebar__brand-school">
              <span className="sidebar__brand-school-name">{activeSchool.name}</span>
            </div>
          )}
        </div>
        {navigation}
        {accountBlock}
      </aside>

      <div className="app-shell__main">
        <header className="topbar">
          <button
            ref={menuButtonRef}
            type="button"
            className="icon-button topbar__menu"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={drawerOpen}
            aria-controls="mobile-navigation"
          >
            <MenuIcon />
          </button>
          <span className="topbar__title">
            <LogoMark size={26} />
            <span>Phikila</span>
          </span>
          {offline && (
            <span className="topbar__offline" role="status">
              Offline
            </span>
          )}
          {schools.length > 1 && (
            <select
              className="topbar__school"
              value={activeSchoolId ?? ''}
              onChange={(event) => {
                const id = Number(event.target.value)
                if (Number.isFinite(id) && id > 0) {
                  setActiveSchool(id)
                  window.location.assign('/')
                }
              }}
              aria-label="Switch school"
              title={activeSchool ? `Active school: ${activeSchool.name}` : 'Switch school'}
            >
              {schools.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            className="icon-button topbar__theme"
            onClick={() => setTheme((current) => (current === 'light' ? 'dark' : 'light'))}
            aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            {theme === 'light' ? <MoonIcon width={18} height={18} /> : <SunIcon width={18} height={18} />}
          </button>
          <span className="topbar__user" title={user?.email ?? ''}>
            <span className="topbar__avatar" aria-hidden="true">{accountInitial}</span>
            <span className="topbar__user-email">{user?.email}</span>
          </span>
        </header>

        {drawerOpen && (
          <div className="drawer-overlay" onClick={() => setDrawerOpen(false)} role="presentation" />
        )}

        <aside
          id="mobile-navigation"
          ref={drawerRef}
          className={`sidebar sidebar--drawer ${drawerOpen ? 'sidebar--open' : ''}`.trim()}
          role="dialog"
          aria-modal={drawerOpen || undefined}
          aria-label="Navigation menu"
          aria-hidden={!drawerOpen}
          {...(!drawerOpen ? { inert: '' as unknown as boolean } : {})}
        >
          <div className="sidebar__brand">
            <Logo size={32} tone="dark" />
            <button
              type="button"
              className="icon-button"
              onClick={() => {
                setDrawerOpen(false)
                menuButtonRef.current?.focus()
              }}
              aria-label="Close navigation menu"
            >
              <CloseIcon />
            </button>
          </div>
          {navigation}
          {accountBlock}
        </aside>

        <main className="app-shell__content" id="main-content">
          {children}
        </main>

        <nav className="bottom-nav" aria-label="Quick navigation">
          {bottomNav.map((item) => {
            const active = isActive(pathname, item.to)
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`bottom-nav__item ${active ? 'bottom-nav__item--active' : ''}`.trim()}
                aria-current={active ? 'page' : undefined}
              >
                <span className="bottom-nav__icon" aria-hidden="true">
                  {item.icon}
                </span>
                <span className="bottom-nav__label">{item.label}</span>
              </Link>
            )
          })}
        </nav>

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
