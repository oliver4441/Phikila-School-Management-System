import { useState } from 'react'

/** Small day/period picker used to ask "why can't it go here?". */
export function MoveExplorer({
  days,
  periods,
  onAsk,
}: {
  days: { index: number; name: string }[]
  periods: { index: number; name: string; is_teaching: boolean }[]
  onAsk: (day: number, period: number) => void
}) {
  const teaching = periods.filter((p) => p.is_teaching)
  const [day, setDay] = useState(days[0]?.index ?? 0)
  const [period, setPeriod] = useState(teaching[0]?.index ?? 0)

  return (
    <div className="move-explorer">
      <div className="field field--inline">
        <label className="field__label" htmlFor="why-day">
          Day
        </label>
        <select
          id="why-day"
          className="input input--select"
          value={day}
          onChange={(event) => setDay(Number(event.target.value))}
        >
          {days.map((d) => (
            <option key={d.index} value={d.index}>
              {d.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field field--inline">
        <label className="field__label" htmlFor="why-period">
          Period
        </label>
        <select
          id="why-period"
          className="input input--select"
          value={period}
          onChange={(event) => setPeriod(Number(event.target.value))}
        >
          {teaching.map((p) => (
            <option key={p.index} value={p.index}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <button type="button" className="button button--secondary button--sm" onClick={() => onAsk(day, period)}>
        Why?
      </button>
    </div>
  )
}
