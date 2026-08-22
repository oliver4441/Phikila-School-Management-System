import type { ReactNode } from 'react'
import { normalisePath } from '../../lib/router'
import {
  CalendarIcon,
  CheckIcon,
  DashboardIcon,
  GridIcon,
  InboxIcon,
  LayersIcon,
  SchoolIcon,
  SparkIcon,
  UserIcon,
} from '../icons'

export type NavItem = { to: string; label: string; icon?: ReactNode }
export type NavGroup = { label: string; items: NavItem[] }

export const PLATFORM_NAV: NavGroup = {
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
export const NAV: NavGroup[] = [
  {
    label: 'Home',
    items: [
      { to: '/', label: 'Dashboard', icon: <DashboardIcon /> },
      { to: '/insights', label: 'Insights', icon: <LayersIcon /> },
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

export const BOTTOM_NAV: NavItem[] = [
  { to: '/', label: 'Home', icon: <DashboardIcon /> },
  { to: '/attendance', label: 'Attendance', icon: <CheckIcon /> },
  { to: '/timetable', label: 'Timetable', icon: <CalendarIcon /> },
  { to: '/finance', label: 'Finance', icon: <GridIcon /> },
  { to: '/students', label: 'Students', icon: <UserIcon /> },
]

export function isActive(pathname: string, to: string) {
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

export function routesForRole(role: string | null, isSuperAdmin: boolean): Set<string> | null {
  if (isSuperAdmin || role === 'admin') return null
  return new Set(ROLE_ALLOWED_ROUTES[role ?? 'student'] ?? ROLE_ALLOWED_ROUTES.student)
}
