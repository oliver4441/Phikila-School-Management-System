import { useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { EmptyState } from '../components/States'

type Task = {
  id: number
  title: string
  description: string
  category: 'admissions' | 'finance' | 'attendance' | 'academics' | 'scheduling'
  priority: 'high' | 'medium' | 'low'
  dueDate: string
  completed: boolean
}

const MOCK_TASKS: Task[] = [
  {
    id: 1,
    title: 'Review admission applications',
    description: '12 applications pending review for the new term.',
    category: 'admissions',
    priority: 'high',
    dueDate: 'Tomorrow',
    completed: false,
  },
  {
    id: 2,
    title: 'Approve fee structures',
    description: 'Fee structures for Term 2 need approval before publishing.',
    category: 'finance',
    priority: 'high',
    dueDate: 'Today',
    completed: false,
  },
  {
    id: 3,
    title: 'Mark attendance for Class 4A',
    description: 'Attendance not yet recorded for today\'s morning session.',
    category: 'attendance',
    priority: 'medium',
    dueDate: 'Today',
    completed: false,
  },
  {
    id: 4,
    title: 'Enter examination marks',
    description: 'Mid-term exam marks for Grade 6 pending entry.',
    category: 'academics',
    priority: 'medium',
    dueDate: 'This week',
    completed: false,
  },
  {
    id: 5,
    title: 'Resolve timetable conflict',
    description: 'Mathematics and Physics overlap in Form 3 Schedule B.',
    category: 'scheduling',
    priority: 'low',
    dueDate: 'Next week',
    completed: true,
  },
]

export default function TasksPage() {
  const [tasks, setTasks] = useState(MOCK_TASKS)
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all')

  const filtered = filter === 'all' ? tasks : filter === 'pending' ? tasks.filter((t) => !t.completed) : tasks.filter((t) => t.completed)
  const pendingCount = tasks.filter((t) => !t.completed).length

  function toggleComplete(id: number) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)))
  }

  function getPriorityColor(priority: Task['priority']) {
    switch (priority) {
      case 'high': return 'var(--color-danger)'
      case 'medium': return 'var(--color-warning)'
      case 'low': return 'var(--color-success)'
    }
  }

  function getCategoryLabel(category: Task['category']) {
    const labels: Record<Task['category'], string> = {
      admissions: 'Admissions',
      finance: 'Finance',
      attendance: 'Attendance',
      academics: 'Academics',
      scheduling: 'Scheduling',
    }
    return labels[category]
  }

  return (
    <>
      <PageHeader
        title="Tasks"
        actions={
          <span style={{ fontSize: '0.85rem', color: 'var(--color-ink-muted)' }}>
            {pendingCount} pending
          </span>
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
          className={`button button--sm ${filter === 'pending' ? 'button--primary' : 'button--ghost'}`}
          onClick={() => setFilter('pending')}
        >
          Pending
        </button>
        <button
          className={`button button--sm ${filter === 'completed' ? 'button--primary' : 'button--ghost'}`}
          onClick={() => setFilter('completed')}
        >
          Completed
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No tasks" description={filter === 'completed' ? 'No completed tasks.' : filter === 'pending' ? 'All tasks completed!' : 'No tasks yet.'} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {filtered.map((task) => (
            <div
              key={task.id}
              className="card"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 'var(--space-3)',
                padding: 'var(--space-4)',
                opacity: task.completed ? 0.6 : 1,
              }}
            >
              <input
                type="checkbox"
                checked={task.completed}
                onChange={() => toggleComplete(task.id)}
                style={{ marginTop: '0.2rem' }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
                  <strong style={{
                    fontSize: '0.9rem',
                    textDecoration: task.completed ? 'line-through' : 'none',
                  }}>
                    {task.title}
                  </strong>
                  <span style={{
                    fontSize: '0.7rem',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '999px',
                    background: getPriorityColor(task.priority),
                    color: '#fff',
                    fontWeight: 600,
                  }}>
                    {task.priority}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-ink-muted)' }}>
                  {task.description}
                </p>
                <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-2)', fontSize: '0.75rem', color: 'var(--color-ink-muted)' }}>
                  <span>{getCategoryLabel(task.category)}</span>
                  <span>Due: {task.dueDate}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
