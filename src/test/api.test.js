import { describe, it, expect, vi } from 'vitest'
import { createMailClient, ApiError } from '../api.js'

function jsonRes(body, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText: 'x',
    json: () => Promise.resolve(body),
  })
}

describe('createMailClient — URL building', () => {
  it('trims trailing slash from baseUrl', () => {
    const c = createMailClient({ baseUrl: 'https://m.example.com/v1/' })
    expect(c.baseUrl).toBe('https://m.example.com/v1')
  })

  it('builds list URL with folder + limit query', () => {
    const c = createMailClient({ baseUrl: '/v1' })
    expect(c.buildUrl('/messages', { folder: 'INBOX/Archive', limit: 50 }))
      .toBe('/v1/messages?folder=INBOX%2FArchive&limit=50')
  })

  it('omits empty/undefined query values', () => {
    const c = createMailClient({ baseUrl: '/v1' })
    expect(c.buildUrl('/search', { folder: 'INBOX', q: '', limit: undefined }))
      .toBe('/v1/search?folder=INBOX')
  })
})

describe('createMailClient — requests', () => {
  it('listMessages unwraps {messages} and sends credentials', async () => {
    const fetch = vi.fn(() => jsonRes({ folder: 'INBOX', messages: [{ id: '1' }] }))
    const c = createMailClient({ baseUrl: '/v1', fetch })
    const msgs = await c.listMessages({ folder: 'INBOX', limit: 10 })
    expect(msgs).toEqual([{ id: '1' }])
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('/v1/messages?folder=INBOX&limit=10')
    expect(init.credentials).toBe('include')
  })

  it('setFlag PATCHes the flags endpoint with a JSON body', async () => {
    const fetch = vi.fn(() => Promise.resolve({ ok: true, status: 204 }))
    const c = createMailClient({ baseUrl: '/v1', fetch })
    const out = await c.setFlag('42', '\\Seen', true, { folder: 'INBOX' })
    expect(out).toBeNull()
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('/v1/messages/42/flags?folder=INBOX')
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body)).toEqual({ flag: '\\Seen', add: true })
  })

  it('throws ApiError with status on 401', async () => {
    const fetch = vi.fn(() => jsonRes({ error: 'not authenticated' }, 401))
    const c = createMailClient({ baseUrl: '/v1', fetch })
    await expect(c.me()).rejects.toMatchObject({ status: 401 })
    await expect(c.me()).rejects.toBeInstanceOf(ApiError)
  })

  it('sendMessage POSTs the draft body to /v1/messages', async () => {
    const fetch = vi.fn(() => jsonRes({ sent: true }, 201))
    const c = createMailClient({ baseUrl: '/v1', fetch })
    await c.sendMessage({ to: 'a@x.com', subject: 'Hi', text: 'yo' })
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('/v1/messages')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ to: 'a@x.com', subject: 'Hi', text: 'yo' })
  })
})

describe('createMailClient — attachment download', () => {
  it('GETs the attachment route with credentials and returns the blob', async () => {
    const blob = new Blob(['pdf-bytes'], { type: 'application/pdf' })
    const fetch = vi.fn(() => Promise.resolve({
      ok: true, status: 200,
      headers: { get: () => null },
      blob: () => Promise.resolve(blob),
    }))
    const origCreate = URL.createObjectURL
    const origRevoke = URL.revokeObjectURL
    URL.createObjectURL = vi.fn(() => 'blob:demo')
    URL.revokeObjectURL = vi.fn()
    try {
      const c = createMailClient({ baseUrl: '/v1', fetch })
      const out = await c.downloadAttachment('1005', '1', 'invoice.pdf')
      expect(out).toBe(blob)
      const [url, init] = fetch.mock.calls[0]
      expect(url).toBe('/v1/messages/1005/attachments/1')
      expect(init.method).toBe('GET')
      expect(init.credentials).toBe('include')
      expect(URL.createObjectURL).toHaveBeenCalledWith(blob)
    } finally {
      URL.createObjectURL = origCreate
      URL.revokeObjectURL = origRevoke
    }
  })

  it('rejects with ApiError(404) when the route is absent (capability probe)', async () => {
    const fetch = vi.fn(() => jsonRes({ error: 'no such route' }, 404))
    const c = createMailClient({ baseUrl: '/v1', fetch })
    await expect(c.downloadAttachment('1005', '1', 'f.pdf')).rejects.toMatchObject({ status: 404 })
  })
})

describe('createMailClient — calendar & contacts', () => {
  it('listEvents serialises Date range to RFC 3339 query and unwraps {events}', async () => {
    const fetch = vi.fn(() => jsonRes({ events: [{ uid: 'e1' }] }))
    const c = createMailClient({ baseUrl: '/v1', fetch })
    const start = new Date('2026-06-01T00:00:00Z')
    const end = new Date('2026-07-01T00:00:00Z')
    const evs = await c.listEvents({ start, end })
    expect(evs).toEqual([{ uid: 'e1' }])
    const [url] = fetch.mock.calls[0]
    expect(url).toBe('/v1/calendar/events?start=2026-06-01T00%3A00%3A00.000Z&end=2026-07-01T00%3A00%3A00.000Z')
  })

  it('listContacts unwraps {contacts} and passes q', async () => {
    const fetch = vi.fn(() => jsonRes({ contacts: [{ email: 'a@x.com', name: 'A' }] }))
    const c = createMailClient({ baseUrl: '/v1', fetch })
    const rows = await c.listContacts({ q: 'a' })
    expect(rows).toEqual([{ email: 'a@x.com', name: 'A' }])
    expect(fetch.mock.calls[0][0]).toBe('/v1/contacts?q=a')
  })

  it('deleteEvent DELETEs the uid path', async () => {
    const fetch = vi.fn(() => Promise.resolve({ ok: true, status: 204 }))
    const c = createMailClient({ baseUrl: '/v1', fetch })
    const out = await c.deleteEvent('uid-1')
    expect(out).toBeNull()
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('/v1/calendar/events/uid-1')
    expect(init.method).toBe('DELETE')
  })

  it('updateEvent PUTs to the uid path with serialised times + uid in body', async () => {
    const fetch = vi.fn(() => jsonRes({ updated: true }))
    const c = createMailClient({ baseUrl: '/v1', fetch })
    const start = new Date('2026-06-02T09:00:00Z')
    const end = new Date('2026-06-02T10:00:00Z')
    await c.updateEvent('e9', { summary: 'Sync', start, end, path: '/cal/e9.ics' })
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('/v1/calendar/events/e9')
    expect(init.method).toBe('PUT')
    const body = JSON.parse(init.body)
    expect(body).toMatchObject({ uid: 'e9', summary: 'Sync', path: '/cal/e9.ics' })
    expect(body.start).toBe('2026-06-02T09:00:00.000Z')
  })

  it('listContactCards unwraps {contacts} from the cards endpoint', async () => {
    const fetch = vi.fn(() => jsonRes({ contacts: [{ uid: 'c1', name: 'A', emails: ['a@x.com'] }] }))
    const c = createMailClient({ baseUrl: '/v1', fetch })
    const rows = await c.listContactCards({ q: 'a' })
    expect(rows).toEqual([{ uid: 'c1', name: 'A', emails: ['a@x.com'] }])
    expect(fetch.mock.calls[0][0]).toBe('/v1/contacts/cards?q=a')
  })

  it('createContact POSTs the body and returns the saved contact', async () => {
    const fetch = vi.fn(() => jsonRes({ contact: { uid: 'new', name: 'B', emails: ['b@x.com'] } }, 201))
    const c = createMailClient({ baseUrl: '/v1', fetch })
    const saved = await c.createContact({ name: 'B', emails: ['b@x.com'] })
    expect(saved).toEqual({ uid: 'new', name: 'B', emails: ['b@x.com'] })
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('/v1/contacts')
    expect(init.method).toBe('POST')
  })

  it('updateContact PUTs to the uid path with uid injected', async () => {
    const fetch = vi.fn(() => jsonRes({ contact: { uid: 'c1' } }))
    const c = createMailClient({ baseUrl: '/v1', fetch })
    await c.updateContact('c1', { name: 'A', emails: ['a@x.com'], path: '/ab/c1.vcf' })
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('/v1/contacts/c1')
    expect(init.method).toBe('PUT')
    expect(JSON.parse(init.body)).toMatchObject({ uid: 'c1', path: '/ab/c1.vcf' })
  })

  it('deleteContact DELETEs the uid path with optional ?path', async () => {
    const fetch = vi.fn(() => Promise.resolve({ ok: true, status: 204 }))
    const c = createMailClient({ baseUrl: '/v1', fetch })
    await c.deleteContact('c1', { path: '/ab/c1.vcf' })
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('/v1/contacts/c1?path=%2Fab%2Fc1.vcf')
    expect(init.method).toBe('DELETE')
  })
})
