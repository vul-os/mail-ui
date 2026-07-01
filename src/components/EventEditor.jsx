import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icon.jsx'

/**
 * <EventEditor/> — modal to create / edit / delete a calendar event.
 *
 * Wired to the /v1 CalDAV endpoints via the callbacks (the parent owns the
 * client). Supports title, date, start/end time, all-day, location, notes and a
 * simple recurrence rule (none / daily / weekly / monthly / yearly) mapped to an
 * iCalendar RRULE — enough for a daily-driver without an RRULE builder.
 *
 * @param {object} props
 * @param {object} props.initial  - seed event ({uid?, summary, start, end, allDay, location, description, recurrence, path})
 * @param {(event)=>Promise<void>} props.onSave
 * @param {(event)=>Promise<void>} [props.onDelete] - shown only when editing
 * @param {()=>void} props.onClose
 */
export default function EventEditor({ initial = {}, onSave, onDelete, onClose }) {
  const editing = Boolean(initial.uid)
  const start0 = toDate(initial.start) || nextHour()
  const end0 = toDate(initial.end) || new Date(start0.getTime() + 60 * 60e3)

  const [summary, setSummary] = useState(initial.summary || '')
  const [allDay, setAllDay] = useState(Boolean(initial.allDay))
  const [date, setDate] = useState(fmtDate(start0))
  const [endDate, setEndDate] = useState(fmtDate(end0))
  const [startTime, setStartTime] = useState(fmtTime(start0))
  const [endTime, setEndTime] = useState(fmtTime(end0))
  const [location, setLocation] = useState(initial.location || '')
  const [description, setDescription] = useState(initial.description || '')
  const [repeat, setRepeat] = useState(freqFromRRule(initial.recurrence))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const titleRef = useRef(null)
  useEffect(() => { titleRef.current?.focus() }, [])

  // Esc closes; the backdrop click closes too (handled below).
  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); onClose?.() }
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); submit() }
  }

  function build() {
    let start, end
    if (allDay) {
      start = atMidnight(date)
      const ed = endDate && endDate >= date ? endDate : date
      end = new Date(atMidnight(ed).getTime() + 24 * 60 * 60e3) // exclusive end (next day)
    } else {
      start = combine(date, startTime)
      end = combine(date, endTime)
      if (!(end > start)) end = new Date(start.getTime() + 60 * 60e3)
    }
    return {
      uid: initial.uid,
      path: initial.path,
      summary: summary.trim(),
      start,
      end,
      allDay,
      location: location.trim(),
      description: description.trim(),
      recurrence: rruleFromFreq(repeat),
    }
  }

  async function submit() {
    setError('')
    if (!summary.trim()) { setError('Add a title'); titleRef.current?.focus(); return }
    setSaving(true)
    try {
      await onSave?.(build())
      onClose?.()
    } catch (e) {
      setError(e?.message || 'Could not save event')
      setSaving(false)
    }
  }

  async function remove() {
    if (!onDelete) return
    if (!window.confirm('Delete this event?')) return
    setSaving(true)
    try {
      await onDelete(build())
      onClose?.()
    } catch (e) {
      setError(e?.message || 'Could not delete event')
      setSaving(false)
    }
  }

  const node = (
    <div className="vm-modal" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.() }}>
      <div className="vm-dialog vm-event-editor" role="dialog" aria-modal="true" aria-label={editing ? 'Edit event' : 'New event'} onKeyDown={onKeyDown}>
        <header className="vm-dialog-head">
          <h2>{editing ? 'Edit event' : 'New event'}</h2>
          <button type="button" className="vm-iconbtn vm-sm" aria-label="Close" onClick={onClose}><Icon name="close" /></button>
        </header>

        <div className="vm-dialog-body">
          <input
            ref={titleRef}
            className="vm-input vm-event-title"
            type="text"
            value={summary}
            placeholder="Add title"
            aria-label="Title"
            onChange={(e) => setSummary(e.target.value)}
          />

          <label className="vm-check">
            <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
            <span>All day</span>
          </label>

          <div className="vm-field-row">
            <label className="vm-field">
              <span>{allDay ? 'Start date' : 'Date'}</span>
              <input className="vm-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date" />
            </label>
            {allDay ? (
              <label className="vm-field">
                <span>End date</span>
                <input className="vm-input" type="date" value={endDate} min={date} onChange={(e) => setEndDate(e.target.value)} aria-label="End date" />
              </label>
            ) : (
              <>
                <label className="vm-field vm-field-sm">
                  <span>Start</span>
                  <input className="vm-input" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} aria-label="Start time" />
                </label>
                <label className="vm-field vm-field-sm">
                  <span>End</span>
                  <input className="vm-input" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} aria-label="End time" />
                </label>
              </>
            )}
          </div>

          <label className="vm-field">
            <span>Repeat</span>
            <select className="vm-input" value={repeat} onChange={(e) => setRepeat(e.target.value)} aria-label="Repeat">
              <option value="none">Does not repeat</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </label>

          <label className="vm-field">
            <span>Location</span>
            <div className="vm-input-icon">
              <Icon name="mappin" className="vm-icon" />
              <input className="vm-input" type="text" value={location} placeholder="Add location" onChange={(e) => setLocation(e.target.value)} aria-label="Location" />
            </div>
          </label>

          <label className="vm-field">
            <span>Notes</span>
            <textarea className="vm-input vm-textarea" rows={3} value={description} placeholder="Add notes" onChange={(e) => setDescription(e.target.value)} aria-label="Notes" />
          </label>

          {error && <div className="vm-error" role="alert">{error}</div>}
        </div>

        <footer className="vm-dialog-foot">
          {editing && onDelete && (
            <button type="button" className="vm-btn vm-btn-ghost vm-danger" onClick={remove} disabled={saving}>
              <Icon name="trash" /> Delete
            </button>
          )}
          <span className="vm-spacer" />
          <button type="button" className="vm-btn vm-btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className="vm-btn vm-btn-primary" onClick={submit} disabled={saving} title="Save (⌘↵)">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </footer>
      </div>
    </div>
  )
  return typeof document !== 'undefined' ? createPortal(node, document.body) : node
}

// ── date/time helpers ───────────────────────────────────────────────────────

function toDate(v) {
  if (!v) return null
  const d = v instanceof Date ? v : new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}
function pad(n) { return String(n).padStart(2, '0') }
function fmtDate(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
function fmtTime(d) { return `${pad(d.getHours())}:${pad(d.getMinutes())}` }
function nextHour() { const d = new Date(); d.setMinutes(0, 0, 0); d.setHours(d.getHours() + 1); return d }
function atMidnight(dateStr) { const [y, m, d] = dateStr.split('-').map(Number); return new Date(y, m - 1, d) }
function combine(dateStr, timeStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const [hh, mm] = (timeStr || '00:00').split(':').map(Number)
  return new Date(y, m - 1, d, hh || 0, mm || 0)
}

// Map the repeat select <-> an iCalendar RRULE FREQ.
function rruleFromFreq(freq) {
  switch (freq) {
    case 'daily': return 'FREQ=DAILY'
    case 'weekly': return 'FREQ=WEEKLY'
    case 'monthly': return 'FREQ=MONTHLY'
    case 'yearly': return 'FREQ=YEARLY'
    default: return ''
  }
}
function freqFromRRule(rrule) {
  if (!rrule) return 'none'
  const m = /FREQ=([A-Z]+)/i.exec(rrule)
  const f = m ? m[1].toLowerCase() : ''
  return ['daily', 'weekly', 'monthly', 'yearly'].includes(f) ? f : 'none'
}
