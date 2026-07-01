/**
 * api.js — typed-ish JS client for the lilmail JSON API (`/v1`).
 *
 * Contract: see lilmail/docs/API.md. Session-cookie auth (credentials are
 * always included). 401 responses return JSON `{ error }`; this client surfaces
 * them as an ApiError with `.status === 401` so the UI can react in code.
 *
 * Folders ride as the `?folder=` query param (default INBOX). UIDs are numeric
 * path segments. Flag/delete return 204 (no body).
 */

const DEFAULT_FOLDER = 'INBOX'

/** Error thrown for any non-2xx response, carrying the HTTP status. */
export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/**
 * Create a mail API client bound to a base URL.
 *
 * @param {object} [opts]
 * @param {string} [opts.baseUrl='/v1'] - origin + prefix, e.g. '/v1' (same
 *   origin) or 'https://mail.example.com/v1'. Trailing slash is trimmed.
 * @param {typeof fetch} [opts.fetch] - fetch impl override (tests / SSR).
 */
export function createMailClient(opts = {}) {
  const baseUrl = (opts.baseUrl ?? '/v1').replace(/\/$/, '')
  const fetchImpl = opts.fetch ?? globalThis.fetch

  /** Build a full URL for a path + query object (omits undefined/empty values). */
  function buildUrl(path, query) {
    let url = baseUrl + path
    if (query) {
      const qs = new URLSearchParams()
      for (const [k, v] of Object.entries(query)) {
        if (v === undefined || v === null || v === '') continue
        qs.set(k, String(v))
      }
      const s = qs.toString()
      if (s) url += '?' + s
    }
    return url
  }

  async function request(path, { query, method = 'GET', body } = {}) {
    const init = { method, credentials: 'include', headers: {} }
    if (body !== undefined) {
      init.headers['Content-Type'] = 'application/json'
      init.body = JSON.stringify(body)
    }
    const res = await fetchImpl(buildUrl(path, query), init)
    if (res.status === 204) return null
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}))
      throw new ApiError(payload.error || res.statusText || 'request failed', res.status)
    }
    // Some success responses (204 handled above) always carry JSON.
    return res.json()
  }

  return {
    baseUrl,
    buildUrl,

    /** GET /v1/me → { email, username } */
    me() {
      return request('/me')
    },

    /** GET /v1/folders → MailboxInfo[] */
    async listFolders() {
      const data = await request('/folders')
      return data.folders ?? []
    },

    /** GET /v1/messages?folder=&limit= → Email[] */
    async listMessages({ folder = DEFAULT_FOLDER, limit = 50 } = {}) {
      const data = await request('/messages', { query: { folder, limit } })
      return data.messages ?? []
    },

    /** GET /v1/messages/:uid?folder= → Email */
    getMessage(uid, { folder = DEFAULT_FOLDER } = {}) {
      return request(`/messages/${encodeURIComponent(uid)}`, { query: { folder } })
    },

    /** GET /v1/search?folder=&q=&limit= → Email[] */
    async search(q, { folder = DEFAULT_FOLDER, limit = 100 } = {}) {
      const data = await request('/search', { query: { folder, q, limit } })
      return data.messages ?? []
    },

    /** PATCH /v1/messages/:uid/flags?folder= body {flag, add} → 204 */
    setFlag(uid, flag, add, { folder = DEFAULT_FOLDER } = {}) {
      return request(`/messages/${encodeURIComponent(uid)}/flags`, {
        method: 'PATCH',
        query: { folder },
        body: { flag, add: !!add },
      })
    },

    /**
     * DELETE /v1/messages/:uid?folder=&hard= → 204
     * Default moves to Trash (lilmail branch v1-mail-actions); hard=true expunges.
     */
    deleteMessage(uid, { folder = DEFAULT_FOLDER, hard = false } = {}) {
      return request(`/messages/${encodeURIComponent(uid)}`, {
        method: 'DELETE',
        query: { folder, hard: hard ? 'true' : undefined },
      })
    },

    /**
     * POST /v1/messages/:uid/move?folder= body {toFolder} → 204
     * Archive / move to another folder via IMAP MOVE (lilmail v1-mail-actions).
     * Rejects if the endpoint is absent so callers can degrade gracefully.
     */
    moveMessage(uid, toFolder, { folder = DEFAULT_FOLDER } = {}) {
      return request(`/messages/${encodeURIComponent(uid)}/move`, {
        method: 'POST',
        query: { folder },
        body: { toFolder },
      })
    },

    /**
     * POST /v1/messages — send a message.
     * @param {{to,cc?,bcc?,subject,text?,html?,inReplyTo?}} draft
     */
    sendMessage(draft) {
      return request('/messages', { method: 'POST', body: draft })
    },

    /** POST /v1/drafts — save a draft. Same body shape as sendMessage. */
    saveDraft(draft) {
      return request('/drafts', { method: 'POST', body: draft })
    },

    // ── Calendar (requires lilmail [caldav] enabled) ──────────────────────

    /** GET /v1/calendar/events?start=&end= → CalendarEvent[] */
    async listEvents({ start, end } = {}) {
      const data = await request('/calendar/events', { query: { start: iso(start), end: iso(end) } })
      return data.events ?? []
    },

    /** POST /v1/calendar/events → { created } */
    createEvent(event) {
      return request('/calendar/events', {
        method: 'POST',
        body: { ...event, start: iso(event.start), end: iso(event.end) },
      })
    },

    /**
     * PUT /v1/calendar/events/:uid → { updated }
     * Idempotent edit. Pass `event.path` (from listEvents) so the update targets
     * the exact CalDAV object instead of forking a duplicate. Optional endpoint:
     * older servers 404/405, so callers can degrade to delete+create.
     */
    updateEvent(uid, event) {
      return request(`/calendar/events/${encodeURIComponent(uid)}`, {
        method: 'PUT',
        body: { ...event, uid, start: iso(event.start), end: iso(event.end) },
      })
    },

    /** DELETE /v1/calendar/events/:uid → 204 */
    deleteEvent(uid) {
      return request(`/calendar/events/${encodeURIComponent(uid)}`, { method: 'DELETE' })
    },

    /** GET /v1/calendar/freebusy?start=&end= → { start, end }[] */
    async freeBusy({ start, end } = {}) {
      const data = await request('/calendar/freebusy', { query: { start: iso(start), end: iso(end) } })
      return data.busy ?? []
    },

    // ── Contacts (requires lilmail [carddav] enabled) ─────────────────────

    /** GET /v1/contacts?q=&limit= → { email, name }[] (lean; compose autocomplete) */
    async listContacts({ q = '', limit } = {}) {
      const data = await request('/contacts', { query: { q, limit } })
      return data.contacts ?? []
    },

    /**
     * GET /v1/contacts/cards?q=&limit= → Contact[]  (full cards for the view)
     * Contact = { uid, name, org?, title?, note?, emails[], phones?, path? }.
     * Optional endpoint (lilmail wave2): rejects with ApiError(404) on older
     * servers so the UI can fall back to the lean listContacts form.
     */
    async listContactCards({ q = '', limit } = {}) {
      const data = await request('/contacts/cards', { query: { q, limit } })
      return data.contacts ?? []
    },

    /** POST /v1/contacts → { contact } (server mints the uid) */
    async createContact(contact) {
      const data = await request('/contacts', { method: 'POST', body: contact })
      return data?.contact ?? data
    },

    /** PUT /v1/contacts/:uid → { contact }. Pass `contact.path` to target the card. */
    async updateContact(uid, contact) {
      const data = await request(`/contacts/${encodeURIComponent(uid)}`, {
        method: 'PUT',
        body: { ...contact, uid },
      })
      return data?.contact ?? data
    },

    /** DELETE /v1/contacts/:uid?path= → 204 */
    deleteContact(uid, { path } = {}) {
      return request(`/contacts/${encodeURIComponent(uid)}`, {
        method: 'DELETE',
        query: { path },
      })
    },

    // ── Account / capability probes (optional; older servers may 404) ─────

    /**
     * GET /v1/quota → { used, limit } in bytes (mailbox storage).
     * Optional endpoint: rejects with ApiError(404) on servers without it, so
     * the UI hides the storage meter rather than showing a dead control.
     */
    quota() {
      return request('/quota')
    },

    /**
     * GET /v1/messages/:uid/attachments/:partId → binary attachment.
     *
     * Streams the attachment body to a Blob and triggers a browser "save as"
     * using `filename` (falling back to the server's Content-Disposition, then
     * a generic name). Returns the Blob so callers/tests can inspect it.
     *
     * This is a download (blob save), never innerHTML — no XSS surface. The
     * route is optional (lilmail /v1 attachments branch): it rejects with
     * ApiError(404)/(405) on servers without it so the UI can disable the
     * download affordance, mirroring the archive/quota capability probes.
     *
     * @param {string|number} uid - message UID (numeric path segment)
     * @param {string|number} partId - MIME part id of the attachment
     * @param {string} [filename] - preferred save-as name
     */
    async downloadAttachment(uid, partId, filename) {
      const path = `/messages/${encodeURIComponent(uid)}/attachments/${encodeURIComponent(partId)}`
      const res = await fetchImpl(buildUrl(path), { method: 'GET', credentials: 'include' })
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        throw new ApiError(payload.error || res.statusText || 'download failed', res.status)
      }
      const blob = await res.blob()
      const name = filename || filenameFromDisposition(res.headers) || 'attachment'
      saveBlob(blob, name)
      return blob
    },
  }
}

/** Parse a filename from a Content-Disposition header (RFC 5987 aware). */
function filenameFromDisposition(headers) {
  try {
    const cd = headers?.get?.('Content-Disposition')
    if (!cd) return ''
    const star = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(cd)
    if (star) return decodeURIComponent(star[1].trim().replace(/^"|"$/g, ''))
    const plain = /filename="?([^";]+)"?/i.exec(cd)
    return plain ? plain[1].trim() : ''
  } catch {
    return ''
  }
}

/**
 * Trigger a browser download for a Blob. No-op outside a DOM (tests / SSR) or
 * when object URLs are unavailable, so the API client stays environment-safe.
 */
function saveBlob(blob, filename) {
  if (typeof document === 'undefined') return
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return
  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoke on the next tick so the click has time to start the download.
  setTimeout(() => {
    if (typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(href)
  }, 0)
}

/** Coerce a Date | ISO string | undefined to an RFC 3339 string (or undefined). */
function iso(v) {
  if (v == null || v === '') return undefined
  if (v instanceof Date) return v.toISOString()
  return String(v)
}

// IMAP system flags used across the UI.
export const FLAG_SEEN = '\\Seen'
export const FLAG_FLAGGED = '\\Flagged'

export default createMailClient
