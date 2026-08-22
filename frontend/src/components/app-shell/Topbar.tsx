import type { RefObject } from 'react'
import { LogoMark } from '../Logo'
import { MenuIcon, MoonIcon, SunIcon } from '../icons'
import { useTheme } from '../../lib/theme'

export function Topbar({
  menuButtonRef,
  drawerOpen,
  onOpenDrawer,
  offline,
  schools,
  activeSchoolId,
  activeSchoolName,
  onSelectSchool,
  email,
  accountInitial,
}: {
  menuButtonRef: RefObject<HTMLButtonElement | null>
  drawerOpen: boolean
  onOpenDrawer: () => void
  offline: boolean
  schools: { id: number; name: string }[]
  activeSchoolId: number | null
  activeSchoolName?: string
  onSelectSchool: (id: number) => void
  email?: string | null
  accountInitial: string
}) {
  const { theme, cycle: cycleTheme } = useTheme()
  return (
    <header className="topbar">
      <button
        ref={menuButtonRef}
        type="button"
        className="icon-button topbar__menu"
        onClick={onOpenDrawer}
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
              onSelectSchool(id)
              window.location.assign('/')
            }
          }}
          aria-label="Switch school"
          title={activeSchoolName ? `Active school: ${activeSchoolName}` : 'Switch school'}
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
        onClick={cycleTheme}
        aria-label={theme === 'dark' ? 'Switch to light mode' : theme === 'light' ? 'Switch to dark mode' : 'Switch to system mode'}
        title={theme === 'dark' ? 'Switch to light mode' : theme === 'light' ? 'Switch to dark mode' : 'Switch to system mode'}
      >
        {theme === 'dark' ? <SunIcon width={18} height={18} /> : <MoonIcon width={18} height={18} />}
      </button>
      <span className="topbar__user" title={email ?? ''}>
        <span className="topbar__avatar" aria-hidden="true">{accountInitial}</span>
        <span className="topbar__user-email">{email}</span>
      </span>
    </header>
  )
}
