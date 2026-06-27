import { useCallback, useEffect, useMemo, useState } from 'react'
import Icon from './Icon.jsx'
import Calendar from './Calendar.jsx'

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

/** 6×7 Monday-first grid of Date cells covering the month of `anchor`. */
function monthGrid(anchor) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const offset = (first.getDay() + 6) % 7
  const start = new Date(first); start.setDate(1 - offset)
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start); d.setDate(start.getDate() + i); return d
  })
}
const fmtTime = (iso) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}
const dayLabel = (d, today) => {
  if (sameDay(d, today)) return 'Today'
  const tm = new Date(today); tm.setDate(today.getDate() + 1)
  if (sameDay(d, tm)) return 'Tomorrow'
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

/**
 * <CalendarPanel/> — the persistent right-hand calendar side panel (Gmail-style).
 *
 * Mini month picker + an agenda of upcoming events (today → next ~2 weeks),
 * expandable in place to the full <Calendar/> month grid, with a hide toggle
 * (state persisted by the host). Reuses the /v1 calendar data path; if the
 * client/back-end exposes no calendar it renders nothing.
 */
export default function CalendarPanel({
  client, onAuthError, expanded = false, onToggleExpand, onHide,
}) {
  const hasCalendar = typeof client?.listEvents === 'function'
  const [anchor, setAnchor] = useState(() => new Date())
  const [events, setEvents] = useState([])
  const [error, setError] = useState('')

  const handleError = useCallback((e) => {
    if (e?.status === 401) onAuthError?.(e)
    return e?.message || 'Could not load calendar'
  }, [onAuthError])

  // Mini view loads a forward window for the agenda + dots; the full view
  // (<Calendar/>) manages its own range, so skip the fetch when expanded.
  const [rangeStart, rangeEnd] = useMemo(() => {
    const s = monthGrid(anchor)[0]
    const e = new Date(s); e.setDate(s.getDate() + 42)
    return [s, e]
  }, [anchor])

  useEffect(() => {
    if (!hasCalendar || expanded) return
    let live = true
    setError('')
    client.listEvents({ start: rangeStart, end: rangeEnd })
      .then((evs) => { if (live) setEvents(evs || []) })
      .catch((e) => { if (live) { setError(handleError(e)); setEvents([]) } })
    return () => { live = false }
  }, [client, hasCalendar, expanded, rangeStart, rangeEnd, handleError])

  const eventDays = useMemo(() => {
    const set = new Set()
    for (const ev of events) {
      const d = new Date(ev.start)
      if (!Number.isNaN(d.getTime())) set.add(d.toDateString())
    }
    return set
  }, [events])

  const today = new Date()
  const agenda = useMemo(() => {
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    return [...events]
      .filter((ev) => new Date(ev.start) >= start)
      .sort((a, b) => new Date(a.start) - new Date(b.start))
      .slice(0, 8)
  }, [events]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!hasCalendar) return null

  const grid = monthGrid(anchor)
  const step = (delta) => setAnchor((a) => new Date(a.getFullYear(), a.getMonth() + delta, 1))

  return (
    <aside className={'vm-calpanel' + (expanded ? ' vm-calpanel-expanded' : '')} aria-label="Calendar">
      <header className="vm-calpanel-head">
        <h2><Icon name="calendar" className="vm-icon" /> Calendar</h2>
        <span className="vm-calpanel-actions">
          <button type="button" className="vm-iconbtn vm-sm" aria-label={expanded ? 'Collapse calendar' : 'Expand calendar'}
            title={expanded ? 'Collapse' : 'Expand'} onClick={onToggleExpand}>
            <Icon name={expanded ? 'collapse' : 'expand'} />
          </button>
          <button type="button" className="vm-iconbtn vm-sm" aria-label="Hide calendar" title="Hide" onClick={onHide}>
            <Icon name="close" />
          </button>
        </span>
      </header>

      {expanded ? (
        <div className="vm-calpanel-full">
          <Calendar client={client} defaultView="month" onAuthError={onAuthError} />
        </div>
      ) : (
        <div className="vm-calpanel-body">
          {error && <div className="vm-error" role="alert">{error}</div>}

          <div className="vm-mini">
            <div className="vm-mini-head">
              <span className="vm-mini-title">{MONTHS[anchor.getMonth()]} {anchor.getFullYear()}</span>
              <span className="vm-mini-nav">
                <button type="button" className="vm-iconbtn vm-sm" aria-label="Previous month" onClick={() => step(-1)}><Icon name="prev" /></button>
                <button type="button" className="vm-iconbtn vm-sm" aria-label="Next month" onClick={() => step(1)}><Icon name="next" /></button>
              </span>
            </div>
            <div className="vm-mini-grid">
              {WEEKDAYS.map((w, i) => <span key={i} className="vm-mini-dow">{w}</span>)}
              {grid.map((d) => {
                const muted = d.getMonth() !== anchor.getMonth()
                const isToday = sameDay(d, today)
                const hasEv = eventDays.has(d.toDateString())
                return (
                  <button key={d.toISOString()} type="button"
                    className={'vm-mini-day' + (muted ? ' vm-muted' : '') + (isToday ? ' vm-today' : '')}
                    onClick={() => setAnchor(new Date(d))}
                    aria-label={d.toDateString()}>
                    {d.getDate()}
                    {hasEv && <span className="vm-mini-dot" aria-hidden="true" />}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="vm-calpanel-agenda">
            <h3 className="vm-calpanel-agenda-title">Upcoming</h3>
            {agenda.length === 0 ? (
              <p className="vm-calpanel-empty">No upcoming events</p>
            ) : (
              <ul className="vm-mini-agenda">
                {agenda.map((ev, i) => {
                  const d = new Date(ev.start)
                  return (
                    <li key={ev.uid || i} className="vm-mini-ev">
                      <span className="vm-mini-ev-rail" aria-hidden="true" />
                      <span className="vm-mini-ev-main">
                        <span className="vm-mini-ev-sum">{ev.summary || '(busy)'}</span>
                        <span className="vm-mini-ev-when">
                          {dayLabel(d, today)}{ev.allDay ? ' · All day' : ' · ' + fmtTime(ev.start)}
                          {ev.location ? ' · ' + ev.location : ''}
                        </span>
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </aside>
  )
}
