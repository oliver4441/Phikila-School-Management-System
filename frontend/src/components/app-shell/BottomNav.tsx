import { Link } from '../../lib/router'
import { isActive, type NavItem } from './navConfig'

export function BottomNav({ items, pathname }: { items: NavItem[]; pathname: string }) {
  return (
    <nav className="bottom-nav" aria-label="Quick navigation">
      {items.map((item) => {
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
  )
}
