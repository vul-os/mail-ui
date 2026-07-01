import { useCallback, useEffect, useMemo, useState } from 'react'
import { createMailClient } from '../api.js'
import Icon from './Icon.jsx'
import EventEditor from './EventEditor.jsx'
import '../index.css'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const HOURS = Array.from({ length: 24 }, (_, i) => i)
const HOUR_H = 44 // px per hour row in week/day time grids

const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

/** Build a 6×7 grid of Date cells (Monday-first) covering the month of `anchor`. */
function monthGrid(anchor) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const offset = (first.getDay() + 6) % 7 // Mon=0
  const gridStart = new Date(first)
  gridStart.setDate(1 - offset)
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart)
    d.setDate(gridStart.getDate() + i)
    return d
  })
}

/** Monday 00:00 of the week containing `d`. */
function weekStart(d) {
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  s.setDate(s.getDate() - ((s.getDay() + 6) % 7))
  return s
}

function fmtTime(iso) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}
const minutesInto = (d) => d.getHours() * 60 + d.getMinutes()

/**
 * <Calendar/> — month / week / day / agenda views over the /v1 calendar API,
 * with create / edit / delete wired to the CalDAV-backed endpoints.
 *
 * @param {object} props
 * @param {string} [props.baseUrl='/v1']
 * @param {object} [props.client]        - pre-built client (overrides baseUrl)
 * @param {(err) => void} [props.onAuthError]
 * @param {'month'|'week'|'day'|'agenda'} [props.defaultView='month']
 */
export default function Calendar({ baseUrl = '/v1', client: clientProp, onAuthError, defaultView = 'month' }) {
  const client = useMemo(() => clientProp ?? createMailClient({ baseUrl }), [clientProp, baseUrl])
  const canWrite = typeof client.createEvent === 'function'

  const [anchor, setAnchor] = useState(() => new Date())
  const [view, setView] = useState(defaultView) // 'month' | 'week' | 'day' | 'agenda'
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editor, setEditor] = useState(null) // null | { initial }
  const [reloadKey, setReloadKey] = useState(0)

  const handleError = useCallback((e) => {
    if (e?.status === 401) onAuthError?.(e)
    return e?.message || 'Could not load calendar'
  }, [onAuthError])

  // Fetch range spans the whole visible surface for the current view.
  const [rangeStart, rangeEnd] = useMemo(() => {
    if (view === 'week') {
      const s = weekStart(anchor)
      const e = new Date(s); e.setDate(s.getDate() + 7)
      return [s, e]
    }
    if (view === 'day') {
      const s = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate())
      const e = new Date(s); e.setDate(s.getDate() + 1)
      return [s, e]
    }
    const grid = monthGrid(anchor)
    const start = grid[0]
    const end = new Date(grid[41]); end.setDate(end.getDate() + 1)
    return [start, end]
  }, [anchor, view])

  useEffect(() => {
    let live = true
    setLoading(true)
    setError('')
    client.listEvents({ start: rangeStart, end: rangeEnd })
      .then((evs) => { if (live) setEvents(evs) })
      .catch((e) => { if (live) { setError(handleError(e)); setEvents([]) } })
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [client, rangeStart, rangeEnd, handleError, reloadKey])

  const reload = useCallback(() => setReloadKey((k) => k + 1), [])

  const eventsByDay = useMemo(() => {
    const map = new Map()
    for (const ev of events) {
      const d = new Date(ev.start)
      if (Number.isNaN(d.getTime())) continue
      const key = d.toDateString()
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(ev)
    }
    for (const list of map.values()) list.sort((a, b) => new Date(a.start) - new Date(b.start))
    return map
  }, [events])

  const agenda = useMemo(
    () => [...events].sort((a, b) => new Date(a.start) - new Date(b.start)),
    [events],
  )

  // ── Navigation ──────────────────────────────────────────────────────────
  const step = useCallback((delta) => {
    setAnchor((a) => {
      const d = new Date(a)
      if (view === 'month' || view === 'agenda') d.setMonth(d.getMonth() + delta)
      else if (view === 'week') d.setDate(d.getDate() + 7 * delta)
      else d.setDate(d.getDate() + delta)
      return d
    })
  }, [view])

  // ── Create / edit / delete ──────────────────────────────────────────────
  const openNew = useCallback((seed) => {
    if (!canWrite) return
    setEditor({ initial: seed || {} })
  }, [canWrite])

  const openEdit = useCallback((ev) => {
    if (!canWrite) return
    setEditor({ initial: { ...ev } })
  }, [canWrite])

  const saveEvent = useCallback(async (ev) => {
    if (ev.uid && typeof client.updateEvent === 'function') {
      try {
        await client.updateEvent(ev.uid, ev)
      } catch (e) {
        // Older servers may lack PUT; fall back to delete + recreate.
        if (e?.status === 404 || e?.status === 405) {
          await client.deleteEvent(ev.uid).catch(() => {})
          await client.createEvent(ev)
        } else { throw e }
      }
    } else {
      await client.createEvent(ev)
    }
    reload()
  }, [client, reload])

  const deleteEvent = useCallback(async (ev) => {
    if (ev.uid) await client.deleteEvent(ev.uid)
    reload()
  }, [client, reload])

  const today = new Date()
  const grid = monthGrid(anchor)

  const title = useMemo(() => {
    if (view === 'day') return anchor.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
    if (view === 'week') {
      const s = weekStart(anchor); const e = new Date(s); e.setDate(s.getDate() + 6)
      const sameMonth = s.getMonth() === e.getMonth()
      return sameMonth
        ? `${MONTHS[s.getMonth()]} ${s.getDate()}–${e.getDate()}, ${s.getFullYear()}`
        : `${MONTHS[s.getMonth()]} ${s.getDate()} – ${MONTHS[e.getMonth()]} ${e.getDate()}`
    }
    return `${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`
  }, [anchor, view])

  const VIEWS = [
    ['month', 'grid', 'Month'],
    ['week', 'list', 'Week'],
    ['day', 'clock', 'Day'],
    ['agenda', 'menu', 'Agenda'],
  ]

  return (
    <div className="vm-cal">
      <header className="vm-cal-head">
        <div className="vm-cal-nav">
          <button type="button" className="vm-iconbtn" aria-label="Previous" onClick={() => step(-1)}>
            <Icon name="prev" />
          </button>
          <button type="button" className="vm-btn vm-btn-ghost vm-cal-today" onClick={() => setAnchor(new Date())}>
            Today
          </button>
          <button type="button" className="vm-iconbtn" aria-label="Next" onClick={() => step(1)}>
            <Icon name="next" />
          </button>
          <h2 className="vm-cal-title">{title}</h2>
        </div>
        <div className="vm-cal-headright">
          {canWrite && (
            <button type="button" className="vm-btn vm-btn-primary vm-cal-new" onClick={() => openNew()}>
              <Icon name="plus" /> New event
            </button>
          )}
          <div className="vm-cal-views" role="tablist" aria-label="Calendar view">
            {VIEWS.map(([id, icon, label]) => (
              <button key={id} type="button" role="tab" aria-selected={view === id}
                className={'vm-seg' + (view === id ? ' vm-on' : '')} onClick={() => setView(id)}>
                <Icon name={icon} /> {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {error && <div className="vm-error" role="alert">{error}</div>}

      {view === 'month' && (
        <div className="vm-cal-grid" aria-busy={loading}>
          {WEEKDAYS.map((w) => <div key={w} className="vm-cal-dow">{w}</div>)}
          {grid.map((d) => {
            const dayEvents = eventsByDay.get(d.toDateString()) || []
            const muted = d.getMonth() !== anchor.getMonth()
            return (
              <div key={d.toISOString()} className={'vm-cal-cell' + (muted ? ' vm-muted' : '')}
                onClick={() => openNew({ start: at(d, 9), end: at(d, 10) })}>
                <span className={'vm-cal-num' + (sameDay(d, today) ? ' vm-today' : '')}>{d.getDate()}</span>
                <div className="vm-cal-evs">
                  {dayEvents.slice(0, 3).map((ev, i) => (
                    <button key={ev.uid || i} type="button" className="vm-cal-ev" title={ev.summary}
                      onClick={(e) => { e.stopPropagation(); openEdit(ev) }}>
                      {!ev.allDay && <em>{fmtTime(ev.start)}</em>} {ev.summary || '(busy)'}
                    </button>
                  ))}
                  {dayEvents.length > 3 && <span className="vm-cal-more">+{dayEvents.length - 3} more</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {(view === 'week' || view === 'day') && (
        <TimeGrid
          days={view === 'week'
            ? Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart(anchor)); d.setDate(d.getDate() + i); return d })
            : [new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate())]}
          eventsByDay={eventsByDay}
          today={today}
          loading={loading}
          onCreate={openNew}
          onEdit={openEdit}
        />
      )}

      {view === 'agenda' && (
        <div className="vm-agenda" aria-busy={loading}>
          {agenda.length === 0 ? (
            <div className="vm-empty">{loading ? 'Loading…' : 'No events this month'}</div>
          ) : (
            <ul className="vm-agenda-list">
              {agenda.map((ev, i) => (
                <li key={ev.uid || i} className="vm-agenda-row">
                  <button type="button" className="vm-agenda-btn" onClick={() => openEdit(ev)}>
                    <div className="vm-agenda-when">
                      <span className="vm-agenda-date">{new Date(ev.start).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                      <span className="vm-agenda-time">{ev.allDay ? 'All day' : fmtTime(ev.start)}</span>
                    </div>
                    <div className="vm-agenda-main">
                      <span className="vm-agenda-sum">{ev.summary || '(no title)'}{ev.recurrence ? ' ↻' : ''}</span>
                      {ev.location && <span className="vm-agenda-loc">{ev.location}</span>}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {editor && (
        <EventEditor
          initial={editor.initial}
          onSave={saveEvent}
          onDelete={editor.initial.uid ? deleteEvent : undefined}
          onClose={() => setEditor(null)}
        />
      )}
    </div>
  )
}

/** Build a Date at `hour` (float) on day `d`. */
function at(d, hour) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(hour), (hour % 1) * 60)
}

/** Week/day hourly time grid with positioned event blocks + an all-day row. */
function TimeGrid({ days, eventsByDay, today, loading, onCreate, onEdit }) {
  return (
    <div className="vm-tg" aria-busy={loading} style={{ '--hour-h': HOUR_H + 'px' }}>
      <div className="vm-tg-head">
        <span className="vm-tg-gutter" />
        {days.map((d) => (
          <span key={d.toISOString()} className={'vm-tg-daycol' + (sameDay(d, today) ? ' vm-today' : '')}>
            <span className="vm-tg-dow">{WEEKDAYS[(d.getDay() + 6) % 7]}</span>
            <span className="vm-tg-dnum">{d.getDate()}</span>
          </span>
        ))}
      </div>

      <div className="vm-tg-allday">
        <span className="vm-tg-gutter vm-tg-alllabel">all-day</span>
        {days.map((d) => {
          const all = (eventsByDay.get(d.toDateString()) || []).filter((e) => e.allDay)
          return (
            <span key={d.toISOString()} className="vm-tg-allcol">
              {all.map((ev, i) => (
                <button key={ev.uid || i} type="button" className="vm-tg-allev" onClick={() => onEdit(ev)} title={ev.summary}>
                  {ev.summary || '(busy)'}
                </button>
              ))}
            </span>
          )
        })}
      </div>

      <div className="vm-tg-scroll">
        <div className="vm-tg-body">
          <div className="vm-tg-gutter vm-tg-hours">
            {HOURS.map((h) => (
              <span key={h} className="vm-tg-hour"><em>{label12(h)}</em></span>
            ))}
          </div>
          {days.map((d) => {
            const timed = (eventsByDay.get(d.toDateString()) || []).filter((e) => !e.allDay)
            return (
              <div key={d.toISOString()} className="vm-tg-col">
                {HOURS.map((h) => (
                  <div key={h} className="vm-tg-slot" onClick={() => onCreate({ start: at(d, h), end: at(d, h + 1) })} />
                ))}
                {timed.map((ev, i) => {
                  const s = new Date(ev.start); const e = new Date(ev.end)
                  const top = (minutesInto(s) / 60) * HOUR_H
                  const mins = Math.max(30, (e - s) / 60000)
                  const height = (mins / 60) * HOUR_H
                  return (
                    <button key={ev.uid || i} type="button" className="vm-tg-ev"
                      style={{ top: top + 'px', height: height + 'px' }}
                      onClick={(ev2) => { ev2.stopPropagation(); onEdit(ev) }}
                      title={ev.summary}>
                      <span className="vm-tg-ev-time">{fmtTime(ev.start)}</span>
                      <span className="vm-tg-ev-sum">{ev.summary || '(busy)'}{ev.recurrence ? ' ↻' : ''}</span>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function label12(h) {
  if (h === 0) return '12 AM'
  if (h === 12) return '12 PM'
  return h < 12 ? `${h} AM` : `${h - 12} PM`
}
