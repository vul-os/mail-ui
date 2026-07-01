/**
 * mockClient.js — in-memory /v1 stand-in for the standalone demo / screenshots.
 * Mirrors createMailClient() (incl. moveMessage + hard-delete) so the full
 * Gmail-class <MailApp/> works with zero backend. Seeded with threads, unread,
 * starred, attachments, multiple folders, contacts and calendar events.
 */
const H = 3600e3
const D = 24 * H
const ago = (ms) => new Date(Date.now() - ms).toISOString()

const inbox = [
  {
    id: '1010', from: 'maya@startup.co', fromName: 'Maya Chen', to: 'me@vulos.org', cc: 'team@startup.co',
    subject: 'Onboarding call recap + next steps',
    preview: 'Great call today! Recapping the key decisions: launch moves to July 14, pricing stays at $29/mo for beta, docs sprint starts Monday.',
    html: '<p>Great call today! Recapping the key decisions:</p><ol><li>Launch date moved to <strong>July 14</strong></li><li>Pricing stays at $29/mo for beta</li><li>Docs sprint starts Monday</li></ol><p>Talk soon,<br>Maya</p>',
    date: ago(0.6 * H), flags: [], messageId: '<onb-1@startup.co>',
  },
  {
    id: '1009', from: 'alice@vulos.org', fromName: 'Alice Mokoena', to: 'me@vulos.org',
    subject: 'Re: Product roadmap Q3 — feedback welcome',
    preview: 'Thanks for sharing the draft. I left comments on sections 2 and 4. The timeline looks ambitious but achievable.',
    html: '<p>Thanks for sharing the draft. I left comments on sections 2 and 4.</p><p>The timeline looks ambitious but achievable if we front-load the infra work. Sync Thursday — does 14:00 UTC work?</p><p>– Alice</p>',
    date: ago(2 * H), flags: ['\\Flagged'],
    messageId: '<road-3@vulos.org>', inReplyTo: '<road-2@vulos.org>',
    references: ['<road-1@vulos.org>', '<road-2@vulos.org>'],
  },
  {
    id: '1008', from: 'me@vulos.org', fromName: 'Me', to: 'alice@vulos.org',
    subject: 'Re: Product roadmap Q3 — feedback welcome',
    preview: 'Sharing the Q3 roadmap draft — would love your thoughts on the timeline before we present to the board.',
    html: '<p>Sharing the Q3 roadmap draft — would love your thoughts on the timeline before we present to the board.</p>',
    date: ago(5 * H), flags: ['\\Seen'],
    messageId: '<road-2@vulos.org>', inReplyTo: '<road-1@vulos.org>', references: ['<road-1@vulos.org>'],
  },
  {
    id: '1007', from: 'alice@vulos.org', fromName: 'Alice Mokoena', to: 'me@vulos.org',
    subject: 'Product roadmap Q3 — feedback welcome',
    preview: 'Hi team, attaching the Q3 roadmap draft. Please review sections 2–4 and share feedback by Friday.',
    html: '<p>Hi team, attaching the Q3 roadmap draft. Please review sections 2–4 and share feedback by Friday.</p>',
    date: ago(8 * H), flags: ['\\Seen'], messageId: '<road-1@vulos.org>',
  },
  {
    id: '1006', from: 'noreply@github.com', fromName: 'GitHub', to: 'me@vulos.org',
    subject: '[vulos/mail-ui] PR #42: Gmail-class webmail',
    preview: 'imranparuk opened a pull request. A full Gmail-class three-pane webmail with threading, multi-select and keyboard shortcuts.',
    html: '<p><strong>imranparuk</strong> opened pull request #42</p><p>A full Gmail-class three-pane webmail with threading, multi-select and keyboard shortcuts.</p><p>Changes: +3120 −876</p>',
    date: ago(5 * H), flags: [], messageId: '<gh-42@github.com>',
  },
  {
    id: '1005', from: 'invoice@stripe.com', fromName: 'Stripe', to: 'me@vulos.org',
    subject: 'Your invoice — $49.00 due',
    preview: 'Invoice INV-2026-0614. Amount due: $49.00 USD. Due date: 30 June 2026.',
    html: '<p>Invoice <strong>INV-2026-0614</strong></p><p>Amount due: $49.00 USD<br>Due date: 30 June 2026</p>',
    date: ago(18 * H), flags: [], hasAttachments: true, messageId: '<inv-0614@stripe.com>',
    attachments: [{ id: '1005/1', filename: 'invoice-INV-2026-0614.pdf', contentType: 'application/pdf', size: 84320 }],
  },
  {
    id: '1004', from: 'bob@designco.io', fromName: 'Bob Osei', to: 'me@vulos.org',
    subject: 'Moodboard for the new landing page',
    preview: 'Hey! Attached are three concept directions for the hero section. Leaning toward option B (the gradient mesh).',
    html: '<p>Hey!</p><p>Attached are three concept directions for the hero section. Leaning toward option B (the gradient mesh).</p><p>Cheers,<br>Bob</p>',
    date: ago(2 * D), flags: ['\\Seen'], hasAttachments: true, messageId: '<mood-1@designco.io>',
    attachments: [
      { id: '1004/1', filename: 'hero-concept-A.png', contentType: 'image/png', size: 512000 },
      { id: '1004/2', filename: 'hero-concept-B.png', contentType: 'image/png', size: 489000 },
    ],
  },
  {
    id: '1003', from: 'security@accounts.google.com', fromName: 'Google', to: 'me@vulos.org',
    subject: 'Security alert: new sign-in on macOS',
    preview: 'Your account was just signed in to from macOS. If this was you, you can ignore this message.',
    html: '<p>Your account was just signed in to from macOS.</p><p>If this was you, you can ignore this message.</p>',
    date: ago(3 * D), flags: ['\\Seen'], messageId: '<sec-1@google.com>',
  },
  {
    id: '1002', from: 'team@linear.app', fromName: 'Linear', to: 'me@vulos.org',
    subject: 'ENG-419 was closed: IMAP IDLE reconnect drops',
    preview: 'Issue ENG-419 — Investigate IMAP IDLE reconnect drops — was closed by imranparuk.',
    html: '<p>Issue <strong>ENG-419</strong> — Investigate IMAP IDLE reconnect drops — was closed by imranparuk.</p>',
    date: ago(4 * D), flags: ['\\Seen'], messageId: '<lin-419@linear.app>',
  },
  {
    id: '1001', from: 'newsletter@techdigest.io', fromName: 'Tech Digest', to: 'me@vulos.org',
    subject: 'This week in open source: Go 1.24, the SFU debate, HTMX hits 30k',
    preview: 'Go 1.24 ships with range-over-func and improved PGO. HTMX crosses 30k GitHub stars. Plus: why SSE is back.',
    html: '<p>Go 1.24 ships with range-over-func and improved PGO. HTMX crosses 30k GitHub stars. Plus: why SSE is back in fashion.</p>',
    date: ago(6 * D), flags: ['\\Seen'], messageId: '<td-w24@techdigest.io>',
  },
]

const sent = [
  {
    id: '2001', from: 'me@vulos.org', fromName: 'Me', to: 'bob@designco.io',
    subject: 'Re: Moodboard for the new landing page',
    preview: 'Option B all the way — the gradient mesh feels modern without being too trendy.',
    html: '<p>Option B all the way — the gradient mesh feels modern without being too trendy.</p>',
    date: ago(1.5 * D), flags: ['\\Seen'], messageId: '<mood-r1@vulos.org>',
  },
]

const drafts = [
  {
    id: '3001', from: 'me@vulos.org', fromName: 'Me', to: 'team@startup.co',
    subject: 'Sprint planning notes — week of June 16',
    preview: 'Capturing the key points from today’s planning. Still working through the acceptance criteria…',
    html: '<p>Capturing the key points from today’s planning. Still working through the acceptance criteria…</p>',
    date: ago(0.5 * H), flags: ['\\Draft', '\\Seen'], messageId: '<draft-1@vulos.org>',
  },
]

const archive = [
  {
    id: '4001', from: 'noreply@status.io', fromName: 'Statuspage', to: 'me@vulos.org',
    subject: 'Resolved: elevated API latency',
    preview: 'The incident affecting API latency has been resolved.',
    html: '<p>The incident affecting API latency has been resolved.</p>',
    date: ago(9 * D), flags: ['\\Seen'], messageId: '<stat-1@status.io>',
  },
]

// Category mailboxes (Gmail-style tabs, mapped gracefully to IMAP folders).
const social = [
  {
    id: '5001', from: 'notifications@chirp.social', fromName: 'Chirp', to: 'me@vulos.org',
    subject: 'Nadia and 4 others reacted to your post',
    preview: 'Your post about self-hosted email is getting attention.',
    html: '<p>Your post about self-hosted email is getting attention.</p>',
    date: ago(3 * H), flags: [], messageId: '<soc-1@chirp.social>',
  },
  {
    id: '5002', from: 'jobs@linkedup.com', fromName: 'LinkedUp', to: 'me@vulos.org',
    subject: '7 new roles match “Platform Engineer”',
    preview: 'New openings in your network this week.',
    html: '<p>New openings in your network this week.</p>',
    date: ago(1.2 * D), flags: ['\\Seen'], messageId: '<soc-2@linkedup.com>',
  },
]
const promotions = [
  {
    id: '6001', from: 'deals@cloudhost.com', fromName: 'CloudHost', to: 'me@vulos.org',
    subject: '40% off dedicated servers — this week only',
    preview: 'Upgrade your infra and save. Limited-time pricing on all plans.',
    html: '<p>Upgrade your infra and save. Limited-time pricing on all plans.</p>',
    date: ago(7 * H), flags: [], messageId: '<promo-1@cloudhost.com>',
  },
]
const updates = [
  {
    id: '7001', from: 'receipts@cloudhost.com', fromName: 'CloudHost Billing', to: 'me@vulos.org',
    subject: 'Your June receipt',
    preview: 'Thanks for your payment of $24.00.',
    html: '<p>Thanks for your payment of $24.00.</p>',
    date: ago(20 * H), flags: ['\\Seen'], hasAttachments: true, messageId: '<upd-1@cloudhost.com>',
    attachments: [{ id: '7001/1', filename: 'receipt-june.pdf', contentType: 'application/pdf', size: 24100 }],
  },
]

// User labels (custom IMAP folders) — one nested to exercise the tree.
const work = [
  {
    id: '8001', from: 'client@acme.co', fromName: 'Acme Co', to: 'me@vulos.org',
    subject: 'Statement of work — Q3 engagement',
    preview: 'Attaching the signed SOW for the Q3 platform work.',
    html: '<p>Attaching the signed SOW for the Q3 platform work.</p>',
    date: ago(1.1 * D), flags: ['\\Seen'], messageId: '<work-1@acme.co>',
  },
]
const personal = [
  {
    id: '9001', from: 'mom@family.net', fromName: 'Mom', to: 'me@vulos.org',
    subject: 'Sunday lunch?',
    preview: 'Are you coming over this Sunday? Bring the dog!',
    html: '<p>Are you coming over this Sunday? Bring the dog!</p>',
    date: ago(2.3 * D), flags: [], messageId: '<pers-1@family.net>',
  },
]

// Extra synthetic inbox history so the list has >1 page and infinite scroll is
// demonstrable in the standalone demo (kept older than the curated top items).
const fillerSenders = [
  ['digest@hn.example', 'Hacker News Digest', 'Top stories: a new Raft implementation, and why your tests are slow'],
  ['updates@figma.com', 'Figma', 'Comments on “Landing v3” from 2 collaborators'],
  ['no-reply@calendar.app', 'Calendar', 'Reminder: Retro tomorrow at 15:00'],
  ['support@fastmail.example', 'Support', 'Re: Ticket #4821 — IMAP folder sync'],
  ['team@notion.so', 'Notion', 'Weekly workspace summary'],
  ['builds@ci.example', 'CI', 'main is green — deploy #1284 succeeded'],
  ['news@changelog.com', 'Changelog', 'The pitch for local-first software'],
  ['hello@vercel.com', 'Vercel', 'Your project had a spike in traffic'],
  ['no-reply@auth0.com', 'Auth0', 'A new device signed in to your tenant'],
  ['digest@lobste.rs', 'Lobsters', 'This week: SQLite tips, and a CRDT primer'],
]
const filler = Array.from({ length: 46 }, (_, i) => {
  const [from, fromName, subject] = fillerSenders[i % fillerSenders.length]
  return {
    id: 'f' + (100 + i),
    from, fromName, to: 'me@vulos.org',
    subject: `${subject} (#${i + 1})`,
    preview: 'Older message kept to exercise pagination and the load-more affordance in the demo.',
    html: `<p>Older message #${i + 1}. Kept to exercise pagination and the load-more affordance in the standalone demo.</p>`,
    date: ago((7 + i) * D), flags: i % 4 === 0 ? [] : ['\\Seen'], messageId: `<filler-${i}@vulos.org>`,
  }
})

const FOLDERS = () => ({
  INBOX: [...inbox, ...filler].map(clone),
  Sent: sent.map(clone),
  Drafts: drafts.map(clone),
  Archive: archive.map(clone),
  Trash: [],
  Spam: [],
  Social: social.map(clone),
  Promotions: promotions.map(clone),
  Updates: updates.map(clone),
  Work: work.map(clone),
  'Work/Clients': [],
  Personal: personal.map(clone),
  Receipts: [],
})

const clone = (m) => ({ ...m, flags: [...(m.flags || [])] })

const now = new Date()
const at = (dayOffset, hour) =>
  new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset, Math.floor(hour), (hour % 1) * 60).toISOString()

const calSeed = [
  { uid: 'e1', summary: 'Standup', start: at(0, 9), end: at(0, 9.5), location: 'Jitsi' },
  { uid: 'e2', summary: 'Roadmap sync w/ Alice', start: at(0, 14), end: at(0, 15) },
  { uid: 'e3', summary: 'Design review', start: at(1, 11), end: at(1, 12) },
  { uid: 'e4', summary: '1:1 with Maya', start: at(2, 16), end: at(2, 16.5) },
  { uid: 'e5', summary: 'Release v1.2', start: at(4, 11), end: at(4, 12), location: 'War room' },
  { uid: 'e6', summary: 'Company offsite', start: at(7, 0), end: at(8, 0), allDay: true },
]

const contactSeed = [
  { uid: 'c1', name: 'Alice Mokoena', org: 'Vulos', title: 'Engineer', emails: ['alice@vulos.org'], phones: ['+27 11 555 0101'], path: '/ab/c1.vcf' },
  { uid: 'c2', name: 'Bob Osei', org: 'DesignCo', emails: ['bob@designco.io'], phones: [], path: '/ab/c2.vcf' },
  { uid: 'c3', name: 'Maya Chen', org: 'Startup', emails: ['maya@startup.co'], phones: [], path: '/ab/c3.vcf' },
  { uid: 'c4', name: 'Vulos Team', emails: ['team@vulos.org'], phones: [], path: '/ab/c4.vcf' },
  { uid: 'c5', name: 'Security', emails: ['security@vulos.org'], phones: [], path: '/ab/c5.vcf' },
  { uid: 'c6', name: 'Imran Paruk', emails: ['imran@vulos.org'], phones: [], path: '/ab/c6.vcf' },
  { uid: 'c7', name: 'Nadia Khan', emails: ['nadia@vulos.org'], phones: [], path: '/ab/c7.vcf' },
  { uid: 'c8', name: 'Sipho Dlamini', emails: ['sipho@vulos.org'], phones: [], path: '/ab/c8.vcf' },
]

export function createMockClient() {
  const store = FOLDERS()
  const find = (folder, uid) => (store[folder] || []).find((m) => m.id === uid)

  return {
    me: async () => ({ email: 'me@vulos.org', username: 'me' }),
    listFolders: async () => {
      const unseen = (k) => (store[k] || []).filter((m) => !m.flags.includes('\\Seen')).length
      return [
        { path: 'INBOX', name: 'INBOX', attributes: ['\\Inbox'], unread: unseen('INBOX') },
        { path: 'Sent', name: 'Sent', attributes: ['\\Sent'] },
        { path: 'Drafts', name: 'Drafts', attributes: ['\\Drafts'], unread: store.Drafts.length },
        { path: 'Archive', name: 'Archive', attributes: ['\\Archive'] },
        { path: 'Spam', name: 'Spam', attributes: ['\\Junk'], unread: unseen('Spam') },
        { path: 'Trash', name: 'Trash', attributes: ['\\Trash'] },
        // Categories (mapped to IMAP folders).
        { path: 'Social', name: 'Social', attributes: [], unread: unseen('Social') },
        { path: 'Promotions', name: 'Promotions', attributes: [], unread: unseen('Promotions') },
        { path: 'Updates', name: 'Updates', attributes: [], unread: unseen('Updates') },
        // User labels (one nested).
        { path: 'Work', name: 'Work', attributes: [], unread: unseen('Work') },
        { path: 'Work/Clients', name: 'Work/Clients', attributes: [] },
        { path: 'Personal', name: 'Personal', attributes: [], unread: unseen('Personal') },
        { path: 'Receipts', name: 'Receipts', attributes: [] },
      ]
    },
    quota: async () => ({ used: 6.4 * 1024 * 1024 * 1024, limit: 15 * 1024 * 1024 * 1024 }),
    listMessages: async ({ folder = 'INBOX' } = {}) => (store[folder] || []).map(clone),
    // Offset-paginated page (mirrors createMailClient.listMessagesPage). Returns
    // total + nextOffset so the UI can drive infinite scroll deterministically.
    listMessagesPage: async ({ folder = 'INBOX', limit = 50, offset = 0 } = {}) => {
      const all = store[folder] || []
      const off = Number(offset) || 0
      const slice = all.slice(off, off + limit).map(clone)
      return { messages: slice, total: all.length, nextOffset: off + slice.length, hasMore: off + slice.length < all.length }
    },
    searchPage: async (q, { folder = 'INBOX', limit = 50, offset = 0 } = {}) => {
      const t = (q || '').toLowerCase()
      const pool = folder ? (store[folder] || []) : Object.values(store).flat()
      const hits = pool.filter((m) => (m.subject + m.preview + m.from + (m.fromName || '')).toLowerCase().includes(t))
      const off = Number(offset) || 0
      const slice = hits.slice(off, off + limit).map(clone)
      return { messages: slice, total: hits.length, nextOffset: off + slice.length, hasMore: off + slice.length < hits.length }
    },
    getMessage: async (uid, { folder = 'INBOX' } = {}) => {
      for (const f of Object.keys(store)) { const m = find(f, uid); if (m) return clone(m) }
      return { ...(find(folder, uid) || {}) }
    },
    search: async (q, { folder = 'INBOX' } = {}) => {
      const t = q.toLowerCase()
      const pool = folder ? (store[folder] || []) : Object.values(store).flat()
      return pool.filter((m) => (m.subject + m.preview + m.from + (m.fromName || '')).toLowerCase().includes(t)).map(clone)
    },
    setFlag: async (uid, flag, add, { folder = 'INBOX' } = {}) => {
      const m = find(folder, uid) || Object.values(store).flat().find((x) => x.id === uid)
      if (m) { const f = new Set(m.flags); add ? f.add(flag) : f.delete(flag); m.flags = [...f] }
      return null
    },
    deleteMessage: async (uid, { folder = 'INBOX', hard = false } = {}) => {
      const list = store[folder] || []
      const i = list.findIndex((m) => m.id === uid)
      if (i >= 0) { const [m] = list.splice(i, 1); if (!hard && folder !== 'Trash') store.Trash.unshift(m) }
      return null
    },
    moveMessage: async (uid, toFolder, { folder = 'INBOX' } = {}) => {
      const list = store[folder] || []
      const i = list.findIndex((m) => m.id === uid)
      if (i >= 0 && store[toFolder]) { const [m] = list.splice(i, 1); store[toFolder].unshift(m) }
      return null
    },
    downloadAttachment: async (uid, partId, filename) => {
      const blob = new Blob([`Demo attachment ${filename || partId} (uid ${uid})`], { type: 'text/plain' })
      if (typeof document !== 'undefined' && typeof URL !== 'undefined' && URL.createObjectURL) {
        const href = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = href; a.download = filename || 'attachment'; document.body.appendChild(a)
        a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(href), 0)
      }
      return blob
    },
    // Stage an outgoing attachment (echoes a fake id). Small artificial delay so
    // the demo shows the "Uploading…" chip state.
    uploadAttachment: async (file) => {
      await new Promise((r) => setTimeout(r, 500))
      return { id: 'att-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7), filename: file?.name || 'file', size: file?.size, contentType: file?.type }
    },
    snooze: async (uid, until, { folder = 'INBOX' } = {}) => {
      const list = store[folder] || []
      const i = list.findIndex((m) => m.id === uid)
      if (i >= 0) list.splice(i, 1)   // demo: just hide it (would re-deliver at `until`)
      return null
    },
    applyLabel: async () => null,
    sendMessage: async (draft) => { console.log('demo send', draft); return { sent: true } },
    saveDraft: async (draft) => { console.log('demo draft', draft); return { saved: true } },
    listEvents: async ({ start, end } = {}) => {
      const s = start ? new Date(start) : null
      const e = end ? new Date(end) : null
      return calSeed
        .filter((ev) => {
          if (!s || !e) return true
          const t = new Date(ev.start)
          return t >= s && t < e
        })
        .map((ev) => ({ ...ev }))
    },
    createEvent: async (e) => { calSeed.push({ ...e, uid: 'e' + (calSeed.length + 1) + '-' + Date.now() }); return { created: true } },
    updateEvent: async (uid, e) => {
      const i = calSeed.findIndex((x) => x.uid === uid)
      if (i >= 0) calSeed[i] = { ...calSeed[i], ...e, uid }
      return { updated: true }
    },
    deleteEvent: async (uid) => {
      const i = calSeed.findIndex((x) => x.uid === uid)
      if (i >= 0) calSeed.splice(i, 1)
      return null
    },
    freeBusy: async () => calSeed.filter((e) => !e.allDay).map(({ start, end }) => ({ start, end })),
    // Lean form (compose autocomplete) — {email,name}.
    listContacts: async ({ q = '' } = {}) =>
      contactSeed
        .filter((c) => (c.name + ' ' + c.emails.join(' ')).toLowerCase().includes(q.toLowerCase()))
        .map((c) => ({ email: c.emails[0], name: c.name })),
    // Full cards (contacts view).
    listContactCards: async ({ q = '' } = {}) =>
      contactSeed
        .filter((c) => (c.name + ' ' + (c.org || '') + ' ' + c.emails.join(' ')).toLowerCase().includes(q.toLowerCase()))
        .map((c) => ({ ...c, emails: [...c.emails], phones: [...(c.phones || [])] })),
    createContact: async (c) => {
      const saved = { ...c, uid: 'c' + (contactSeed.length + 1) + '-' + Date.now(), path: '/ab/new.vcf' }
      contactSeed.push(saved)
      return saved
    },
    updateContact: async (uid, c) => {
      const i = contactSeed.findIndex((x) => x.uid === uid)
      const saved = { ...(i >= 0 ? contactSeed[i] : {}), ...c, uid }
      if (i >= 0) contactSeed[i] = saved; else contactSeed.push(saved)
      return saved
    },
    deleteContact: async (uid) => {
      const i = contactSeed.findIndex((x) => x.uid === uid)
      if (i >= 0) contactSeed.splice(i, 1)
      return null
    },
  }
}
