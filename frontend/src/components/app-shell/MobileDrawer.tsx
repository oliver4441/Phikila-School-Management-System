import { useEffect, useRef, type RefObject } from 'react'
import { Logo } from '../Logo'
import { CloseIcon } from '../icons'
import { AccountBlock, SidebarNav } from './Sidebar'
import type { NavGroup } from './navConfig'

export function MobileDrawer({
  open,
  onClose,
  menuButtonRef,
  groups,
  pathname,
  onSearchClick,
  accountName,
  accountInitial,
  email,
  signingOut,
  onSignOut,
}: {
  open: boolean
  onClose: () => void
  menuButtonRef: RefObject<HTMLButtonElement | null>
  groups: NavGroup[]
  pathname: string
  onSearchClick: () => void
  accountName: string
  accountInitial: string
  email?: string | null
  signingOut: boolean
  onSignOut: () => void
}) {
  const drawerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return

    document.body.classList.add('body--locked')
    const firstLink = drawerRef.current?.querySelector<HTMLElement>('a, button')
    firstLink?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
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
  }, [open])

  return (
    <>
      {open && (
        <div className="drawer-overlay" onClick={onClose} role="presentation" />
      )}

      <aside
        id="mobile-navigation"
        ref={drawerRef}
        className={`sidebar sidebar--drawer ${open ? 'sidebar--open' : ''}`.trim()}
        role="dialog"
        aria-modal={open || undefined}
        aria-label="Navigation menu"
        aria-hidden={!open}
        {...(!open ? { inert: '' as unknown as boolean } : {})}
      >
        <div className="sidebar__brand">
          <Logo size={32} tone="dark" />
          <button
            type="button"
            className="icon-button"
            onClick={() => {
              onClose()
              menuButtonRef.current?.focus()
            }}
            aria-label="Close navigation menu"
          >
            <CloseIcon />
          </button>
        </div>
        <SidebarNav groups={groups} pathname={pathname} onSearchClick={onSearchClick} />
        <AccountBlock
          accountName={accountName}
          accountInitial={accountInitial}
          email={email}
          signingOut={signingOut}
          onSignOut={onSignOut}
        />
      </aside>
    </>
  )
}
