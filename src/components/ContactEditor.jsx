import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icon.jsx'

/**
 * <ContactEditor/> — modal to create / edit / delete a CardDAV contact.
 *
 * Supports the fields a daily-driver address book needs: name, organisation,
 * title, one-or-more emails and phones, and a note. Emails/phones are dynamic
 * rows (add / remove). Wired to /v1 via the parent's callbacks.
 *
 * @param {object} props
 * @param {object} props.initial - seed contact ({uid?, name, org, title, note, emails[], phones[], path})
 * @param {(contact)=>Promise<void>} props.onSave
 * @param {(contact)=>Promise<void>} [props.onDelete] - shown only when editing
 * @param {()=>void} props.onClose
 */
export default function ContactEditor({ initial = {}, onSave, onDelete, onClose }) {
  const editing = Boolean(initial.uid)
  const [name, setName] = useState(initial.name || '')
  const [org, setOrg] = useState(initial.org || '')
  const [title, setTitle] = useState(initial.title || '')
  const [note, setNote] = useState(initial.note || '')
  const [emails, setEmails] = useState(() => atLeastOne(initial.emails))
  const [phones, setPhones] = useState(() => atLeastOne(initial.phones))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const nameRef = useRef(null)
  useEffect(() => { nameRef.current?.focus() }, [])

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); onClose?.() }
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); submit() }
  }

  function build() {
    return {
      uid: initial.uid,
      path: initial.path,
      name: name.trim(),
      org: org.trim(),
      title: title.trim(),
      note: note.trim(),
      emails: emails.map((s) => s.trim()).filter(Boolean),
      phones: phones.map((s) => s.trim()).filter(Boolean),
    }
  }

  async function submit() {
    setError('')
    const c = build()
    if (!c.name && c.emails.length === 0) { setError('Add a name or email'); nameRef.current?.focus(); return }
    setSaving(true)
    try {
      await onSave?.(c)
      onClose?.()
    } catch (e) {
      setError(e?.message || 'Could not save contact')
      setSaving(false)
    }
  }

  async function remove() {
    if (!onDelete) return
    if (!window.confirm('Delete this contact?')) return
    setSaving(true)
    try {
      await onDelete(build())
      onClose?.()
    } catch (e) {
      setError(e?.message || 'Could not delete contact')
      setSaving(false)
    }
  }

  const node = (
    <div className="vm-modal" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.() }}>
      <div className="vm-dialog vm-contact-editor" role="dialog" aria-modal="true" aria-label={editing ? 'Edit contact' : 'New contact'} onKeyDown={onKeyDown}>
        <header className="vm-dialog-head">
          <h2>{editing ? 'Edit contact' : 'New contact'}</h2>
          <button type="button" className="vm-iconbtn vm-sm" aria-label="Close" onClick={onClose}><Icon name="close" /></button>
        </header>

        <div className="vm-dialog-body">
          <label className="vm-field">
            <span>Name</span>
            <input ref={nameRef} className="vm-input" type="text" value={name} placeholder="Full name" onChange={(e) => setName(e.target.value)} aria-label="Name" />
          </label>

          <div className="vm-field-row">
            <label className="vm-field">
              <span>Organisation</span>
              <input className="vm-input" type="text" value={org} placeholder="Company" onChange={(e) => setOrg(e.target.value)} aria-label="Organisation" />
            </label>
            <label className="vm-field">
              <span>Title</span>
              <input className="vm-input" type="text" value={title} placeholder="Role" onChange={(e) => setTitle(e.target.value)} aria-label="Title" />
            </label>
          </div>

          <MultiField label="Email" type="email" values={emails} setValues={setEmails} placeholder="name@example.com" />
          <MultiField label="Phone" type="tel" values={phones} setValues={setPhones} placeholder="+1 555 000 0000" />

          <label className="vm-field">
            <span>Notes</span>
            <textarea className="vm-input vm-textarea" rows={2} value={note} placeholder="Add notes" onChange={(e) => setNote(e.target.value)} aria-label="Notes" />
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

/** A dynamic list of single-line inputs with add / remove rows. */
function MultiField({ label, type, values, setValues, placeholder }) {
  const update = (i, v) => setValues((xs) => xs.map((x, j) => (j === i ? v : x)))
  const add = () => setValues((xs) => [...xs, ''])
  const remove = (i) => setValues((xs) => (xs.length <= 1 ? [''] : xs.filter((_, j) => j !== i)))
  return (
    <div className="vm-field">
      <span>{label}</span>
      {values.map((val, i) => (
        <div key={i} className="vm-multi-row">
          <input className="vm-input" type={type} value={val} placeholder={placeholder}
            onChange={(e) => update(i, e.target.value)} aria-label={`${label} ${i + 1}`} />
          <button type="button" className="vm-iconbtn vm-sm" aria-label={`Remove ${label.toLowerCase()}`} onClick={() => remove(i)}>
            <Icon name="minus" />
          </button>
        </div>
      ))}
      <button type="button" className="vm-linkbtn" onClick={add}><Icon name="plus" /> Add {label.toLowerCase()}</button>
    </div>
  )
}

function atLeastOne(arr) {
  const xs = (arr || []).filter((x) => typeof x === 'string')
  return xs.length ? [...xs] : ['']
}
