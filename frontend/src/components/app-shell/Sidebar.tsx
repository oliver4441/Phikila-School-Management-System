import { Link } from '../../lib/router'
import { Logo } from '../Logo'
import { LogOutIcon, MoonIcon, SearchIcon, SunIcon } from '../icons'
import { useTheme } from '../../lib/theme'
import { isActive, type NavGroup } from './navConfig'

export function SidebarNav({
  groups,
  pathname,
  onSearchClick,
}: {
  groups: NavGroup[]
  pathname: string
  onSearchClick: () => void
}) {
  return (
    <nav className="sidebar__nav" aria-label="Main">
      <div className="sidebar__search-hint" role="button" tabIndex={0} aria-label="Search (Ctrl+K)" onClick={onSearchClick} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSearchClick() } }}>
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
}

export function AccountBlock({
  accountName,
  accountInitial,
  email,
  signingOut,
  onSignOut,
}: {
  accountName: string
  accountInitial: string
  email?: string | null
  signingOut: boolean
  onSignOut: () => void
}) {
  const { theme, cycle: cycleTheme } = useTheme()
  return (
    <div className="sidebar__account">
      <div className="sidebar__account-profile">
        <span className="sidebar__account-avatar" aria-hidden="true">{accountInitial}</span>
        <div>
          <p className="sidebar__account-name" title={accountName}>{accountName}</p>
          <p className="sidebar__account-email">{email}</p>
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
          onClick={onSignOut}
          disabled={signingOut}
        >
          <LogOutIcon width={18} height={18} />
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </div>
  )
}

export function DesktopSidebar({
  activeSchoolName,
  children,
}: {
  activeSchoolName?: string
  children: React.ReactNode
}) {
  return (
    <>
      <div className="sidebar__brand">
        <Logo size={34} tone="dark" />
        {activeSchoolName && (
          <div className="sidebar__brand-school">
            <span className="sidebar__brand-school-name">{activeSchoolName}</span>
          </div>
        )}
      </div>
      {children}
    </>
  )
}
