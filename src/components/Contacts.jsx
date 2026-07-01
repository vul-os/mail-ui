import { useCallback, useEffect, useMemo, useState } from 'react'
import { createMailClient } from '../api.js'
import Icon from './Icon.jsx'
import ContactEditor from './ContactEditor.jsx'
import { avatarStyle } from './avatar.js'
import '../index.css'

const initial = (name = '', email = '') => {
  const s = (name || email).trim()
  return s ? s[0].toUpperCase() : '?'
}

/** Normalise a lean {email,name} row (autocomplete form) to a card shape. */
const asCard = (c) => (Array.isArray(c.emails)
  ? c
  : { uid: c.uid || '', name: c.name || '', emails: c.email ? [c.email] : [], phones: [], org: c.org || '' })

const primaryEmail = (c) => (c.emails && c.emails[0]) || c.email || ''

/**
 * <Contacts/> — CardDAV address book: search, list, and create / edit / delete.
 *
 * Uses the rich `listContactCards` endpoint when the server exposes it (lilmail
 * wave2), falling back to the lean `listContacts` search on older servers (where
 * editing is unavailable). `onSelect` keeps the original behaviour — clicking a
 * contact starts a compose to its primary email.
 *
 * @param {object} props
 * @param {string} [props.baseUrl='/v1']
 * @param {object} [props.client]        - pre-built client (overrides baseUrl)
 * @param {(contact:{email,name}) => void} [props.onSelect] - e.g. start a compose
 * @param {(err) => void} [props.onAuthError]
 */
export default function Contacts({ baseUrl = '/v1', client: clientProp, onSelect, onAuthError }) {
  const client = useMemo(() => clientProp ?? createMailClient({ baseUrl }), [clientProp, baseUrl])
  // Full CRUD needs the cards endpoint; degrade gracefully when it is absent.
  const [canWrite, setCanWrite] = useState(typeof client.listContactCards === 'function')

  const [q, setQ] = useState('')
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editor, setEditor] = useState(null) // null | { initial }
  const [reloadKey, setReloadKey] = useState(0)

  const handleError = useCallback((e) => {
    if (e?.status === 401) onAuthError?.(e)
    return e?.message || 'Could not load contacts'
  }, [onAuthError])

  const reload = useCallback(() => setReloadKey((k) => k + 1), [])

  // Debounced search. Prefer the rich cards endpoint; on 404/405 drop to lean.
  useEffect(() => {
    let live = true
    setLoading(true)
    setError('')
    const useCards = typeof client.listContactCards === 'function'
    const load = async () => {
      try {
        const rows = useCards ? await client.listContactCards({ q }) : await client.listContacts({ q })
        if (live) setContacts((rows || []).map(asCard))
      } catch (e) {
        if (useCards && (e?.status === 404 || e?.status === 405)) {
          // Server has no cards endpoint — fall back to lean search + disable editing.
          if (live) setCanWrite(false)
          try {
            const rows = await client.listContacts({ q })
            if (live) setContacts((rows || []).map(asCard))
          } catch (e2) {
            if (live) { setError(handleError(e2)); setContacts([]) }
          }
        } else if (live) {
          setError(handleError(e)); setContacts([])
        }
      } finally {
        if (live) setLoading(false)
      }
    }
    const t = setTimeout(load, q ? 200 : 0)
    return () => { live = false; clearTimeout(t) }
  }, [client, q, handleError, reloadKey])

  const saveContact = useCallback(async (c) => {
    if (c.uid && typeof client.updateContact === 'function') await client.updateContact(c.uid, c)
    else await client.createContact(c)
    reload()
  }, [client, reload])

  const deleteContact = useCallback(async (c) => {
    if (c.uid) await client.deleteContact(c.uid, { path: c.path })
    reload()
  }, [client, reload])

  const sorted = useMemo(
    () => [...contacts].sort((a, b) => (a.name || primaryEmail(a)).localeCompare(b.name || primaryEmail(b))),
    [contacts],
  )

  return (
    <div className="vm-contacts">
      <header className="vm-contacts-head">
        <div className="vm-brand">
          <Icon name="users" className="vm-icon vm-brand-mark" />
          <span>Contacts</span>
        </div>
        <form className="vm-search" role="search" onSubmit={(e) => e.preventDefault()}>
          <Icon name="search" className="vm-icon" />
          <input
            type="search"
            value={q}
            placeholder="Search contacts"
            aria-label="Search contacts"
            onChange={(e) => setQ(e.target.value)}
          />
        </form>
        {canWrite && (
          <button type="button" className="vm-btn vm-btn-primary vm-sm vm-contacts-new" onClick={() => setEditor({ initial: {} })}>
            <Icon name="plus" /> New
          </button>
        )}
      </header>

      {error && <div className="vm-error" role="alert">{error}</div>}

      {loading ? (
        <ul className="vm-rows">
          {Array.from({ length: 6 }).map((_, i) => (
            <li key={i} className="vm-skeleton" aria-hidden="true">
              <div className="vm-sk-line" style={{ width: '40%' }} />
              <div className="vm-sk-line" style={{ width: '70%' }} />
            </li>
          ))}
        </ul>
      ) : sorted.length === 0 ? (
        <div className="vm-empty">No contacts</div>
      ) : (
        <ul className="vm-contact-list">
          {sorted.map((ct, i) => {
            const email = primaryEmail(ct)
            return (
              <li key={ct.uid || email || i} className="vm-contact-item">
                <button
                  type="button"
                  className="vm-contact-row"
                  onClick={() => (onSelect ? onSelect({ email, name: ct.name }) : (canWrite && setEditor({ initial: ct })))}
                  disabled={!onSelect && !canWrite}
                >
                  <span className="vm-avatar" style={avatarStyle(email || ct.name)} aria-hidden="true">{initial(ct.name, email)}</span>
                  <span className="vm-contact-main">
                    <span className="vm-contact-name">{ct.name || email}</span>
                    {ct.name && email && <span className="vm-contact-email">{email}</span>}
                    {ct.org && <span className="vm-contact-email">{ct.org}</span>}
                  </span>
                </button>
                {canWrite && (
                  <button type="button" className="vm-iconbtn vm-sm vm-contact-edit" aria-label={`Edit ${ct.name || email}`}
                    title="Edit contact" onClick={() => setEditor({ initial: ct })}>
                    <Icon name="edit" />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {editor && (
        <ContactEditor
          initial={editor.initial}
          onSave={saveContact}
          onDelete={editor.initial.uid ? deleteContact : undefined}
          onClose={() => setEditor(null)}
        />
      )}
    </div>
  )
}
