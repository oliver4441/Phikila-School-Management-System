import { useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { EmptyState } from '../components/States'

type Notification = {
  id: number
  title: string
  message: string
  type: 'info' | 'warning' | 'success' | 'error'
  read: boolean
  timestamp: string
}

const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: 1,
    title: 'New admission request',
    message: 'John Mwangi has submitted an admission request for Grade 5.',
    type: 'info',
    read: false,
    timestamp: '2 hours ago',
  },
  {
    id: 2,
    title: 'Fee payment received',
    message: 'Payment of KES 15,000 received from Sarah Ochieng.',
    type: 'success',
    read: false,
    timestamp: '3 hours ago',
  },
  {
    id: 3,
    title: 'Timetable conflict detected',
    message: 'Mathematics and Physics are scheduled for the same slot in Form 3.',
    type: 'warning',
    read: true,
    timestamp: '1 day ago',
  },
  {
    id: 4,
    title: 'Low attendance alert',
    message: 'Class 4B attendance dropped below 70% this week.',
    type: 'error',
    read: true,
    timestamp: '2 days ago',
  },
]

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')

  const filtered = filter === 'unread' ? notifications.filter((n) => !n.read) : notifications
  const unreadCount = notifications.filter((n) => !n.read).length

  function markAsRead(id: number) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
  }

  function markAllAsRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  function getTypeColor(type: Notification['type']) {
    switch (type) {
      case 'info': return 'var(--color-info)'
      case 'warning': return 'var(--color-warning)'
      case 'success': return 'var(--color-success)'
      case 'error': return 'var(--color-danger)'
    }
  }

  return (
    <>
      <PageHeader
        title="Notifications"
        actions={
          unreadCount > 0 ? (
            <button className="button button--ghost button--sm" onClick={markAllAsRead}>
              Mark all as read ({unreadCount})
            </button>
          ) : undefined
        }
      />

      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
        <button
          className={`button button--sm ${filter === 'all' ? 'button--primary' : 'button--ghost'}`}
          onClick={() => setFilter('all')}
        >
          All
        </button>
        <button
          className={`button button--sm ${filter === 'unread' ? 'button--primary' : 'button--ghost'}`}
          onClick={() => setFilter('unread')}
        >
          Unread {unreadCount > 0 && `(${unreadCount})`}
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No notifications" description={filter === 'unread' ? 'No unread notifications.' : 'No notifications yet.'} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {filtered.map((notification) => (
            <div
              key={notification.id}
              className="card"
              style={{
                display: 'flex',
                gap: 'var(--space-3)',
                padding: 'var(--space-4)',
                cursor: 'pointer',
                opacity: notification.read ? 0.7 : 1,
                borderLeft: `3px solid ${getTypeColor(notification.type)}`,
              }}
              onClick={() => markAsRead(notification.id)}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
                  <strong style={{ fontSize: '0.9rem' }}>{notification.title}</strong>
                  {!notification.read && (
                    <span style={{
                      width: '0.5rem',
                      height: '0.5rem',
                      borderRadius: '50%',
                      background: 'var(--brand-emerald)',
                    }} />
                  )}
                </div>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-ink-muted)' }}>
                  {notification.message}
                </p>
                <p style={{ margin: 0, marginTop: 'var(--space-1)', fontSize: '0.75rem', color: 'var(--color-ink-muted)' }}>
                  {notification.timestamp}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
