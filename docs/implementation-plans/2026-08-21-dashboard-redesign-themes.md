# Dashboard Redesign: Themes & Colors

**Goal:** Modernise the Phikila dashboard visual language with a refreshed colour palette, dark mode support, and premium feel — while keeping the existing component structure and UX patterns intact.

**Architecture:** Extend the existing CSS custom property system in `:root` to support theme switching via `data-theme` attribute on `<html>`. Add a dark mode palette alongside the refreshed light palette. Update `dashboard.css` with new gradients, card treatments, and accent colours. Wire a theme toggle into the AppShell.

**Tech Stack:** CSS custom properties, `prefers-color-scheme` media query, existing React context/state patterns.

---

## Phase 1 — Colour Palette Refresh

### Task 1: Refresh Light Mode Palette

**Files:**
- Modify: `frontend/src/index.css` (design tokens section, lines 13–56)

**What changes:**

Replace the current warm/earthy palette with a cleaner, more modern palette. The navy stays as the anchor but the supporting colours shift:

```css
:root {
  /* ---- NEW LIGHT PALETTE ---- */
  --color-bg: #f0f2f5;           /* was #f5f3ec (warm cream) → cooler grey */
  --color-surface: #ffffff;       /* unchanged */
  --color-surface-muted: #f7f8fa; /* was #faf9f5 → cooler tint */
  --color-ink: #111827;           /* was #14231d → neutral black */
  --color-ink-muted: #6b7280;    /* was #5a6660 → neutral grey */
  --color-line: #e5e7eb;         /* was #dcd8cc → neutral border */
  --color-line-strong: #d1d5db;  /* was #c6c1b1 */

  --color-primary: #1e3a5f;      /* was #0f2a47 → richer navy */
  --color-primary-strong: #152c4a;
  --color-primary-soft: #e8eef6;  /* was #e7eef5 */
  --color-accent: #059669;        /* was #0b7f60 → brighter emerald */

  --brand-navy: #1e3a5f;
  --brand-navy-deep: #142640;
  --brand-emerald: #10b981;       /* was #12a47c → Tailwind emerald-500 */
  --brand-emerald-light: #34d399;
  --brand-gold: #f59e0b;          /* was #e0a93b → amber-500, more vibrant */
  --brand-gold-light: #fbbf24;

  --color-success: #059669;
  --color-success-soft: #d1fae5;
  --color-warning: #d97706;
  --color-warning-soft: #fef3c7;
  --color-danger: #dc2626;
  --color-danger-soft: #fee2e2;
  --color-info: #2563eb;
  --color-info-soft: #dbeafe;

  /* Shadows — cooler tone */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.08);
  --shadow-lg: 0 12px 40px rgba(0, 0, 0, 0.12);
  --shadow-glow: 0 0 20px rgba(16, 185, 129, 0.15);  /* NEW: emerald glow */
}
```

**Verify:** Run `cd frontend && NODE_OPTIONS=--dns-result-order=ipv4first npx tsc --noEmit` — no errors. Visually the dashboard should feel cooler and cleaner.

---

### Task 2: Add Dark Mode Palette

**Files:**
- Modify: `frontend/src/index.css` (add new block after `:root`)

**Add after the existing `:root` block:**

```css
/* ---- DARK MODE ---- */
@media (prefers-color-scheme: dark) {
  :root {
    --color-bg: #0f1117;
    --color-surface: #1a1d27;
    --color-surface-muted: #232733;
    --color-ink: #f0f2f5;
    --color-ink-muted: #9ca3af;
    --color-line: #2d3348;
    --color-line-strong: #3d4460;

    --color-primary: #60a5fa;
    --color-primary-strong: #93bbfd;
    --color-primary-soft: rgba(96, 165, 250, 0.12);
    --color-accent: #34d399;

    --brand-navy: #60a5fa;
    --brand-navy-deep: #1e3a5f;
    --brand-emerald: #34d399;
    --brand-emerald-light: #6ee7b7;
    --brand-gold: #fbbf24;
    --brand-gold-light: #fcd34d;

    --color-success: #34d399;
    --color-success-soft: rgba(52, 211, 153, 0.12);
    --color-warning: #fbbf24;
    --color-warning-soft: rgba(251, 191, 36, 0.12);
    --color-danger: #f87171;
    --color-danger-soft: rgba(248, 113, 113, 0.12);
    --color-info: #60a5fa;
    --color-info-soft: rgba(96, 165, 250, 0.12);

    --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
    --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.4);
    --shadow-lg: 0 12px 40px rgba(0, 0, 0, 0.5);
    --shadow-glow: 0 0 20px rgba(52, 211, 153, 0.2);
  }
}

/* ---- DARK MODE (explicit toggle) ---- */
[data-theme="dark"] {
  --color-bg: #0f1117;
  --color-surface: #1a1d27;
  --color-surface-muted: #232733;
  --color-ink: #f0f2f5;
  --color-ink-muted: #9ca3af;
  --color-line: #2d3348;
  --color-line-strong: #3d4460;

  --color-primary: #60a5fa;
  --color-primary-strong: #93bbfd;
  --color-primary-soft: rgba(96, 165, 250, 0.12);
  --color-accent: #34d399;

  --brand-navy: #60a5fa;
  --brand-navy-deep: #1e3a5f;
  --brand-emerald: #34d399;
  --brand-emerald-light: #6ee7b7;
  --brand-gold: #fbbf24;
  --brand-gold-light: #fcd34d;

  --color-success: #34d399;
  --color-success-soft: rgba(52, 211, 153, 0.12);
  --color-warning: #fbbf24;
  --color-warning-soft: rgba(251, 191, 36, 0.12);
  --color-danger: #f87171;
  --color-danger-soft: rgba(248, 113, 113, 0.12);
  --color-info: #60a5fa;
  --color-info-soft: rgba(96, 165, 250, 0.12);

  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 12px 40px rgba(0, 0, 0, 0.5);
  --shadow-glow: 0 0 20px rgba(52, 211, 153, 0.2);
}

[data-theme="light"] {
  /* Explicit light — same as :root defaults above */
  color-scheme: light;
}

[data-theme="dark"] {
  color-scheme: dark;
}
```

---

## Phase 2 — Dashboard Visual Overhaul

### Task 3: Refresh Dashboard Hero

**Files:**
- Modify: `frontend/src/dashboard.css` (hero section)

**Replace hero styles:**

```css
.dashboard-hero {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.25rem;
  padding: 1.5rem 1.75rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 1.25rem;
  background: linear-gradient(135deg, #0f2a47 0%, #1a4a7a 50%, #12a47c 100%);
  color: #fff;
  box-shadow: 0 8px 32px rgba(15, 42, 71, 0.35);
  position: relative;
  overflow: hidden;
}

.dashboard-hero::after {
  content: "";
  position: absolute;
  width: 22rem;
  height: 22rem;
  right: -8rem;
  top: -10rem;
  background: radial-gradient(circle, rgba(224, 169, 59, 0.15) 0%, transparent 70%);
  border-radius: 50%;
  pointer-events: none;
}

.dashboard-hero__eyebrow {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  margin-bottom: 0.3rem;
}

.dashboard-hero__title {
  color: #fff;
  font-size: clamp(1.55rem, 2.6vw, 2.25rem);
  letter-spacing: -0.035em;
}

.dashboard-hero__meta {
  margin-top: 0.4rem;
  color: rgba(255, 255, 255, 0.75);
  font-size: 0.9rem;
}

.dashboard-hero .button--primary {
  background: var(--brand-gold);
  color: #111827;
  border-color: var(--brand-gold);
  box-shadow: 0 2px 8px rgba(245, 158, 11, 0.3);
}

.dashboard-hero .button--primary:hover {
  box-shadow: 0 4px 16px rgba(245, 158, 11, 0.4);
}

.dashboard-hero .button--secondary {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  border-color: rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(4px);
}

/* Dark mode hero */
[data-theme="dark"] .dashboard-hero,
@media (prefers-color-scheme: dark) {
  .dashboard-hero {
    background: linear-gradient(135deg, #1a1d27 0%, #1e3a5f 50%, #065f46 100%);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    border-color: rgba(255, 255, 255, 0.05);
  }
}
```

---

### Task 4: Refresh Metric Cards

**Files:**
- Modify: `frontend/src/dashboard.css` (metric section)

**Replace metric styles:**

```css
.dashboard-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.85rem;
  margin-bottom: 1.25rem;
}

.dashboard-metric {
  min-width: 0;
  border: 1px solid var(--color-line);
  border-radius: 1rem;
  background: var(--color-surface);
  padding: 1rem 1.15rem;
  box-shadow: var(--shadow-sm);
  transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease;
}

.dashboard-metric:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
  border-color: var(--color-primary);
}

.dashboard-metric__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.75rem;
  background: var(--color-primary-soft);
  color: var(--brand-navy);
  transition: background 180ms ease;
}

.dashboard-metric__icon--gold {
  background: var(--color-warning-soft);
  color: var(--color-warning);
}

.dashboard-metric__icon--green {
  background: var(--color-success-soft);
  color: var(--color-success);
}

.dashboard-metric__icon--danger {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

.dashboard-metric__value {
  margin-top: 0.55rem;
  font-size: 1.75rem;
  line-height: 1.05;
  font-weight: 800;
  letter-spacing: -0.04em;
  color: var(--color-ink);
}

.dashboard-metric__detail {
  margin-top: 0.35rem;
  color: var(--color-ink-muted);
  font-size: 0.78rem;
}

.dashboard-metric__link {
  display: inline-flex;
  margin-top: 0.7rem;
  color: var(--brand-emerald);
  font-size: 0.78rem;
  font-weight: 700;
  text-decoration: none;
  transition: color 140ms ease;
}

.dashboard-metric__link:hover {
  color: var(--brand-emerald-light);
}
```

---

### Task 5: Refresh Card Panels

**Files:**
- Modify: `frontend/src/dashboard.css` (panel/grid sections)

**Add new card treatment:**

```css
.dashboard-panel--premium {
  padding: 1.25rem 1.35rem;
  margin-bottom: 0;
  border: 1px solid var(--color-line);
  border-radius: 1rem;
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
  transition: box-shadow 180ms ease, border-color 180ms ease;
}

.dashboard-panel--premium:hover {
  box-shadow: var(--shadow-md);
  border-color: var(--color-line-strong);
}

.dashboard-panel__eyebrow {
  color: var(--brand-emerald);
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.dashboard-panel__action {
  color: var(--brand-emerald);
  font-size: 0.8rem;
  font-weight: 700;
  text-decoration: none;
  transition: color 140ms ease;
}

.dashboard-panel__action:hover {
  color: var(--brand-emerald-light);
}
```

---

### Task 6: Refresh Progress & Quality Bars

**Files:**
- Modify: `frontend/src/dashboard.css`

```css
.dashboard-progress {
  height: 0.6rem;
  border-radius: 999px;
  background: var(--color-line);
  overflow: hidden;
}

.dashboard-progress__bar {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--brand-emerald), var(--brand-emerald-light));
  transition: width 600ms ease-out;
}

.dashboard-quality__bar {
  margin-top: 0.5rem;
  height: 0.4rem;
  border-radius: 999px;
  background: var(--color-line);
  overflow: hidden;
}

.dashboard-quality__fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--brand-emerald), var(--brand-emerald-light));
  transition: width 400ms ease-out;
}

/* When quality is poor, show warning/danger */
.dashboard-quality__item[data-status="danger"] .dashboard-quality__fill {
  background: linear-gradient(90deg, var(--color-danger), #f87171);
}

.dashboard-quality__item[data-status="warning"] .dashboard-quality__fill {
  background: linear-gradient(90deg, var(--color-warning), var(--brand-gold-light));
}
```

---

### Task 7: Refresh Quick Actions

**Files:**
- Modify: `frontend/src/dashboard.css`

```css
.dashboard-quick-actions {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.75rem;
}

.dashboard-quick-action {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  min-height: 4.4rem;
  padding: 0.85rem 1rem;
  border: 1px solid var(--color-line);
  border-radius: 0.85rem;
  background: var(--color-surface);
  color: var(--color-ink);
  text-decoration: none;
  box-shadow: var(--shadow-sm);
  transition: transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease;
}

.dashboard-quick-action:hover {
  transform: translateY(-1px);
  border-color: var(--brand-emerald);
  box-shadow: var(--shadow-md), 0 0 0 1px var(--brand-emerald);
}

.dashboard-quick-action__icon {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 0.6rem;
  background: var(--color-success-soft);
  color: var(--brand-emerald);
}
```

---

## Phase 3 — Dark Mode Hardening

### Task 8: Fix Sidebar for Dark Mode

**Files:**
- Modify: `frontend/src/index.css` (sidebar section)

The sidebar is always dark-themed (navy background). In dark mode, it should stay dark but match the new token values. Add:

```css
/* Sidebar is always dark-themed */
.sidebar {
  background: #0f172a;       /* slate-900 */
  color: #e2e8f0;
}

[data-theme="dark"] .sidebar {
  background: #0b1120;       /* even deeper in dark mode */
}

[data-theme="dark"] .sidebar__link:hover {
  background: rgba(255, 255, 255, 0.06);
}

[data-theme="dark"] .sidebar__link--active {
  background: rgba(96, 165, 250, 0.15);
  border-left-color: var(--brand-emerald);
}
```

---

### Task 9: Fix Tables & Forms for Dark Mode

**Files:**
- Modify: `frontend/src/index.css` (table/form sections)

```css
/* Dark mode table adjustments */
[data-theme="dark"] .table thead th {
  background: var(--color-surface-muted);
  color: var(--color-ink-muted);
}

[data-theme="dark"] .table tbody tr:hover {
  background: var(--color-surface-muted);
}

[data-theme="dark"] .input {
  background: var(--color-surface);
  border-color: var(--color-line);
  color: var(--color-ink);
}

[data-theme="dark"] .input:focus {
  border-color: var(--brand-emerald);
  box-shadow: 0 0 0 3px rgba(52, 211, 153, 0.15);
}

[data-theme="dark"] .checkbox input {
  accent-color: var(--brand-emerald);
}

/* Dark mode skeleton */
[data-theme="dark"] .skeleton {
  background: linear-gradient(90deg, #232733 25%, #2d3348 50%, #232733 75%);
  background-size: 200% 100%;
}
```

---

## Phase 4 — Theme Toggle

### Task 10: Create Theme Context

**Files:**
- Create: `frontend/src/lib/theme.tsx`

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

type Theme = 'light' | 'dark' | 'system'
type Resolved = 'light' | 'dark'

type ThemeContextValue = {
  theme: Theme
  resolved: Resolved
  setTheme: (t: Theme) => void
}

const ThemeCtx = createContext<ThemeContextValue | null>(null)

const STORAGE_KEY = 'phikila.theme'

function getSystemTheme(): Resolved {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'system'
    return (localStorage.getItem(STORAGE_KEY) as Theme) || 'system'
  })

  const resolved: Resolved = theme === 'system' ? getSystemTheme() : theme

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolved)
  }, [resolved])

  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      document.documentElement.setAttribute('data-theme', getSystemTheme())
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  const setTheme = (t: Theme) => {
    setThemeState(t)
    localStorage.setItem(STORAGE_KEY, t)
  }

  return (
    <ThemeCtx.Provider value={{ theme, resolved, setTheme }}>
      {children}
    </ThemeCtx.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeCtx)
  if (!ctx) throw new Error('useTheme must be inside <ThemeProvider>')
  return ctx
}
```

---

### Task 11: Wire ThemeProvider into App

**Files:**
- Modify: `frontend/src/App.tsx`

Import `ThemeProvider` and wrap the root:

```tsx
import { ThemeProvider } from './lib/theme'

// Inside the component tree, wrap everything:
<ThemeProvider>
  <AuthProvider>
    {/* ... existing children */}
  </AuthProvider>
</ThemeProvider>
```

---

### Task 12: Add Theme Toggle to Sidebar

**Files:**
- Modify: `frontend/src/components/AppShell.tsx`

Add a theme toggle button near the bottom of the sidebar (above the account block):

```tsx
import { useTheme } from '../lib/theme'
import { MoonIcon, SunIcon, MonitorIcon } from './icons'

// Inside AppShell, before the account block:
const { theme, setTheme } = useTheme()

function ThemeToggle() {
  const cycle = () => {
    const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light'
    setTheme(next)
  }
  const icon = theme === 'dark' ? <SunIcon /> : theme === 'light' ? <MoonIcon /> : <MonitorIcon />
  const label = theme === 'dark' ? 'Switch to light' : theme === 'light' ? 'Switch to dark' : 'Follow system'

  return (
    <button
      className="icon-button icon-button--subtle"
      onClick={cycle}
      title={label}
      aria-label={label}
    >
      {icon}
    </button>
  )
}
```

Place the `<ThemeToggle />` in the sidebar bottom area.

---

## Phase 5 — Polish & Responsive

### Task 13: Update Landing Page Hero

**Files:**
- Modify: `frontend/src/pages/LandingPage.tsx` or `frontend/src/landing-enhancements.css`

Apply the new gradient to the landing hero for visual consistency with the dashboard.

---

### Task 14: Verify All Pages in Dark Mode

**Pages to check:**
- Dashboard, Students, Attendance, Examinations, Finance
- Timetable, Copilot, OCR
- Auth screens (login, signup)
- Mobile bottom nav
- Command palette

---

## Summary of Colour Changes

| Token | Old (Light) | New (Light) | Dark |
|---|---|---|---|
| Background | `#f5f3ec` (warm cream) | `#f0f2f5` (cool grey) | `#0f1117` |
| Surface | `#ffffff` | `#ffffff` | `#1a1d27` |
| Ink | `#14231d` | `#111827` | `#f0f2f5` |
| Ink muted | `#5a6660` | `#6b7280` | `#9ca3af` |
| Line | `#dcd8cc` | `#e5e7eb` | `#2d3348` |
| Navy | `#0f2a47` | `#1e3a5f` | `#60a5fa` (blue) |
| Emerald | `#12a47c` | `#10b981` | `#34d399` |
| Gold | `#e0a93b` | `#f59e0b` | `#fbbf24` |
| Success | `#096a50` | `#059669` | `#34d399` |
| Warning | `#8a5a10` | `#d97706` | `#fbbf24` |
| Danger | `#9a2f24` | `#dc2626` | `#f87171` |
| Info | `#1c4f74` | `#2563eb` | `#60a5fa` |

## Estimated Effort

| Phase | Tasks | Estimate |
|---|---|---|
| 1 — Palette Refresh | 2 tasks | 20 min |
| 2 — Dashboard Visual | 5 tasks | 45 min |
| 3 — Dark Mode Hardening | 2 tasks | 25 min |
| 4 — Theme Toggle | 3 tasks | 30 min |
| 5 — Polish & Verify | 2 tasks | 20 min |
| **Total** | **14 tasks** | **~2.5 hours** |
