export function ParsedDataView({ data }: { data: Record<string, unknown> }) {
  const type = data.type as string

  if (type === 'exam_sheet') {
    const students = (data.students as Array<Record<string, unknown>>) || []
    const examInfo = (data.exam_info as Record<string, string>) || {}
    const subjects = (data.subjects as string[]) || []

    return (
      <div>
        {Object.entries(examInfo).filter(([, v]) => v).map(([k, v]) => (
          <p key={k} style={{ fontSize: '0.875rem', color: 'var(--color-ink-muted)' }}>
            <strong>{k.replace(/_/g, ' ')}:</strong> {v}
          </p>
        ))}
        <p style={{ fontSize: '0.875rem', fontWeight: 600, marginTop: 'var(--space-2)' }}>
          {students.length} student{students.length !== 1 ? 's' : ''} found
          {subjects.length > 0 ? ` · ${subjects.length} subject${subjects.length !== 1 ? 's' : ''}` : ''}
        </p>
        {students.length > 0 && (
          <div style={{ overflowX: 'auto', marginTop: 'var(--space-2)' }}>
            <table style={{ width: '100%', fontSize: '0.8125rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-line)' }}>
                  <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>#</th>
                  <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>Name</th>
                  {subjects.slice(0, 6).map((s) => (
                    <th key={s} style={{ padding: 'var(--space-2)', textAlign: 'right' }}>{s}</th>
                  ))}
                  {students[0]?.total != null && <th style={{ padding: 'var(--space-2)', textAlign: 'right' }}>Total</th>}
                </tr>
              </thead>
              <tbody>
                {students.map((s, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--color-line)' }}>
                    <td style={{ padding: 'var(--space-2)' }}>{i + 1}</td>
                    <td style={{ padding: 'var(--space-2)', fontWeight: 600 }}>{s.name as string}</td>
                    {subjects.slice(0, 6).map((sub) => (
                      <td key={sub} style={{ padding: 'var(--space-2)', textAlign: 'right' }}>
                        {(s.scores as Record<string, number>)?.[sub] ?? '—'}
                      </td>
                    ))}
                    {s.total != null && (
                      <td style={{ padding: 'var(--space-2)', textAlign: 'right', fontWeight: 700 }}>
                        {s.total as number}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  if (type === 'timetable') {
    const entries = (data.entries as Array<Record<string, string>>) || []
    return (
      <div>
        <p style={{ fontSize: '0.875rem', fontWeight: 600 }}>
          {entries.length} period{entries.length !== 1 ? 's' : ''} across {(data.days_detected as string[])?.length || 0} day(s)
        </p>
        {entries.length > 0 && (
          <div style={{ overflowX: 'auto', marginTop: 'var(--space-2)' }}>
            <table style={{ width: '100%', fontSize: '0.8125rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-line)' }}>
                  <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>Day</th>
                  <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>Time</th>
                  <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>Subject</th>
                  <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>Teacher</th>
                  <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>Room</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--color-line)' }}>
                    <td style={{ padding: 'var(--space-2)' }}>{e.day}</td>
                    <td style={{ padding: 'var(--space-2)' }}>{e.start_time}–{e.end_time}</td>
                    <td style={{ padding: 'var(--space-2)', fontWeight: 600 }}>{e.subject || '—'}</td>
                    <td style={{ padding: 'var(--space-2)' }}>{e.teacher || '—'}</td>
                    <td style={{ padding: 'var(--space-2)' }}>{e.room || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  if (type === 'student_document') {
    const fields = (data.fields as Record<string, string>) || {}
    return (
      <div>
        {Object.entries(fields).length === 0 ? (
          <p style={{ color: 'var(--color-ink-muted)', fontSize: '0.9rem' }}>No structured fields detected.</p>
        ) : (
          <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(14rem, 1fr))', gap: 'var(--space-3)' }}>
            {Object.entries(fields).map(([k, v]) => (
              <div key={k}>
                <dt style={{ color: 'var(--color-ink-muted)', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {k.replace(/_/g, ' ')}
                </dt>
                <dd style={{ marginTop: '0.15rem', fontWeight: 600 }}>{v}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    )
  }

  // General fallback
  const kv = (data.key_value_pairs as Record<string, string>) || {}
  const emails = (data.emails as string[]) || []
  const phones = (data.phones as string[]) || []
  return (
    <div>
      {Object.keys(kv).length > 0 && (
        <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(14rem, 1fr))', gap: 'var(--space-3)' }}>
          {Object.entries(kv).map(([k, v]) => (
            <div key={k}>
              <dt style={{ color: 'var(--color-ink-muted)', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase' }}>
                {k.replace(/_/g, ' ')}
              </dt>
              <dd style={{ marginTop: '0.15rem', fontWeight: 600 }}>{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {(emails.length > 0 || phones.length > 0) && (
        <div style={{ marginTop: 'var(--space-3)', fontSize: '0.875rem' }}>
          {emails.length > 0 && <p><strong>Emails:</strong> {emails.join(', ')}</p>}
          {phones.length > 0 && <p><strong>Phones:</strong> {phones.join(', ')}</p>}
        </div>
      )}
    </div>
  )
}
