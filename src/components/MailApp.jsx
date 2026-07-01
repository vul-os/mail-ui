import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createMailClient, FLAG_SEEN, FLAG_FLAGGED, ApiError } from '../api.js'
import FolderList, { STARRED_FOLDER, classifyFolder, classifyCategory } from './FolderList.jsx'
import MessageList from './MessageList.jsx'
import MessageView from './MessageView.jsx'
import Compose from './Compose.jsx'
import Settings from './Settings.jsx'
import Calendar from './Calendar.jsx'
import CalendarPanel from './CalendarPanel.jsx'
import Contacts from './Contacts.jsx'
import ShortcutsHelp from './ShortcutsHelp.jsx'
import CommandPalette from './CommandPalette.jsx'
import Icon from './Icon.jsx'
import { groupThreads } from './threading.js'
import { useSettings } from './useSettings.js'
import { useKeyboard } from './useKeyboard.js'
import { quoteReply, quoteForward, replyAllCc } from './reply.js'
import '../index.css'

let composeSeq = 0

// How long an undoable destructive action can be reversed before it commits.
const UNDO_MS = 6000

/**
 * <MailApp/> — full Gmail-class webmail, wired to the lilmail /v1 API.
 *
 * @param {object} props
 * @param {string} [props.baseUrl='/v1']
 * @param {object} [props.client]   - pre-built client (overrides baseUrl; tests/demo)
 * @param {(draft)=>(void|Promise<void>)} [props.onSend] - override default send
 * @param {(err)=>void} [props.onAuthError]
 * @param {import('react').ReactNode} [props.settingsExtra] - host-supplied
 *   section(s) rendered at the top of the Settings panel (e.g. the standalone
 *   webmail's account / connection / change-password surface).
 */
export default function MailApp({ baseUrl = '/v1', client: clientProp, onSend, onAuthError, settingsExtra }) {
  const client = useMemo(() => clientProp ?? createMailClient({ baseUrl }), [clientProp, baseUrl])
  const sendDraft = useMemo(() => onSend ?? ((d) => client.sendMessage(d)), [onSend, client])

  const [settings, setSettings] = useSettings()
  const [me, setMe] = useState(null)
  const [folders, setFolders] = useState([])
  const [quota, setQuota] = useState(null)
  const [folder, setFolder] = useState('INBOX')
  const [query, setQuery] = useState('')
  const [messages, setMessages] = useState([])
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState('')

  const [openThread, setOpenThread] = useState(null)
  const [fullById, setFullById] = useState({})
  const [selection, setSelection] = useState(() => new Set())
  const [focusIdx, setFocusIdx] = useState(-1)

  const [composes, setComposes] = useState([])
  const [panel, setPanel] = useState('none')        // none | calendar | contacts | settings
  const [helpOpen, setHelpOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [mobilePane, setMobilePane] = useState('list')  // list | read
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [railCollapsed, setRailCollapsed] = useState(false)
  const [toasts, setToasts] = useState([])
  const [moveSupported, setMoveSupported] = useState(true)
  const [attachmentsSupported, setAttachmentsSupported] = useState(true)

  const searchRef = useRef(null)

  // Apply theme to the app root.
  const rootRef = useRef(null)

  // Theme = 'system' follows the OS light/dark setting live; 'dark'/'light' are
  // explicit. We resolve to a concrete value for the data-theme attribute.
  const [systemDark, setSystemDark] = useState(
    () => typeof matchMedia === 'undefined' || matchMedia('(prefers-color-scheme: dark)').matches,
  )
  useEffect(() => {
    if (typeof matchMedia === 'undefined') return
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e) => setSystemDark(e.matches)
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [])
  const resolvedTheme = settings.theme === 'light' || settings.theme === 'dark'
    ? settings.theme
    : (systemDark ? 'dark' : 'light')

  // Pending deferred-commit timers for undoable (destructive) actions.
  const undoTimers = useRef(new Map())
  useEffect(() => () => { for (const t of undoTimers.current.values()) clearTimeout(t) }, [])

  // The most recent still-reversible action, so pressing `z` undoes it (the
  // "oops, put that back" reflex). Cleared when its undo window lapses.
  const lastUndo = useRef(null)

  // After archiving/deleting the open conversation we advance to the next one
  // (Superhuman-style triage flow). The list is derived state, so we stash the
  // target id here and open it once the recomputed list lands. '__none__' means
  // "nothing left — fall back to the list".
  const pendingOpen = useRef(null)

  const handleError = useCallback((e) => {
    if (e?.status === 401) onAuthError?.(e)
    return e?.message || 'Something went wrong'
  }, [onAuthError])

  const toast = useCallback((text, kind = 'info') => {
    const id = ++composeSeq
    setToasts((t) => [...t, { id, text, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200)
  }, [])

  // An undoable toast: `commit` runs when the undo window lapses; `undo` runs if
  // the user clicks Undo first (the destructive server call is deferred until
  // commit, so undoing is a clean re-fetch — nothing was sent to the server).
  const undoable = useCallback((text, commit, undo) => {
    const id = ++composeSeq
    const timer = setTimeout(() => {
      undoTimers.current.delete(id)
      if (lastUndo.current?.id === id) lastUndo.current = null
      setToasts((t) => t.filter((x) => x.id !== id))
      commit()
    }, UNDO_MS)
    undoTimers.current.set(id, timer)
    const doUndo = () => {
      clearTimeout(timer)
      undoTimers.current.delete(id)
      if (lastUndo.current?.id === id) lastUndo.current = null
      setToasts((tt) => tt.filter((x) => x.id !== id))
      undo()
    }
    lastUndo.current = { id, undo: doUndo }
    setToasts((t) => [...t, { id, text, kind: 'info', undo: doUndo }])
  }, [])

  // Reverse the most recent undoable action (bound to `z`).
  const undoLast = useCallback(() => {
    const u = lastUndo.current
    if (u) { lastUndo.current = null; u.undo() }
  }, [])

  // ── Bootstrap ───────────────────────────────────────────────────────────
  useEffect(() => {
    let live = true
    client.me().then((m) => live && setMe(m)).catch(() => {})
    client.listFolders().then((f) => live && setFolders(f || [])).catch(() => {})
    // Optional storage meter — older /v1 servers 404; degrade by hiding it.
    if (typeof client.quota === 'function') {
      client.quota().then((q) => live && setQuota(q || null)).catch(() => {})
    }
    return () => { live = false }
  }, [client])

  // User labels (custom folders that aren't specials or categories) — fed to the
  // sidebar's Labels section + the Settings overview.
  const labels = useMemo(
    () => folders
      .filter((f) => classifyFolder(f) === 'label' && !classifyCategory(f))
      .map((f) => ({ path: f.path ?? f.name, label: f.name ?? f.path })),
    [folders],
  )

  // Archive target folder (from special-use); archive hidden when absent.
  const archiveFolder = useMemo(() => {
    const f = folders.find((x) => classifyFolder(x) === 'archive')
    return f ? (f.path ?? f.name) : null
  }, [folders])
  const trashFolder = useMemo(() => {
    const f = folders.find((x) => classifyFolder(x) === 'trash')
    return f ? (f.path ?? f.name) : null
  }, [folders])
  const canArchive = moveSupported && Boolean(archiveFolder)

  // ── List loading ─────────────────────────────────────────────────────────
  const loadList = useCallback(async () => {
    setListLoading(true)
    setListError('')
    try {
      let msgs
      if (folder === STARRED_FOLDER) {
        const all = await client.listMessages({ folder: 'INBOX', limit: 200 })
        msgs = all.filter((m) => (m.flags || []).includes(FLAG_FLAGGED))
      } else if (query) {
        msgs = await client.search(query, { folder: folder === STARRED_FOLDER ? 'INBOX' : folder })
      } else {
        msgs = await client.listMessages({ folder })
      }
      setMessages(msgs || [])
    } catch (e) {
      setListError(handleError(e))
      setMessages([])
    } finally {
      setListLoading(false)
    }
  }, [client, folder, query, handleError])

  useEffect(() => { loadList() }, [loadList])

  const threads = useMemo(() => {
    const grouped = groupThreads(messages, { threaded: settings.threaded && folder !== STARRED_FOLDER })
    // Inbox type re-orders the list (client-side, stable so date order holds
    // within each bucket). 'default' keeps newest-active first.
    if (settings.inboxType === 'unread') return [...grouped].sort((a, b) => (b.unread ? 1 : 0) - (a.unread ? 1 : 0))
    if (settings.inboxType === 'starred') return [...grouped].sort((a, b) => (b.starred ? 1 : 0) - (a.starred ? 1 : 0))
    return grouped
  }, [messages, settings.threaded, folder, settings.inboxType])
  const starredCount = useMemo(
    () => messages.filter((m) => (m.flags || []).includes(FLAG_FLAGGED)).length,
    [messages],
  )

  // Keep focusIdx in range.
  useEffect(() => { if (focusIdx >= threads.length) setFocusIdx(threads.length - 1) }, [threads.length, focusIdx])

  // Home the keyboard cursor onto the first row as soon as a list lands, so j/k
  // and Enter work immediately without an initial mouse click.
  useEffect(() => {
    if (!listLoading && focusIdx < 0 && threads.length) setFocusIdx(0)
  }, [listLoading, threads.length, focusIdx])

  // Auto-advance: once the list recomputes after a triage action, open the
  // conversation we queued (or drop back to the list when none is left).
  useEffect(() => {
    const pid = pendingOpen.current
    if (!pid) return
    pendingOpen.current = null
    if (pid !== '__none__') {
      const t = threads.find((x) => x.id === pid)
      if (t) { openThreadFn(t); return }
    }
    setOpenThread(null); setMobilePane('list')
  }, [threads])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Message state patching (optimistic) ───────────────────────────────────
  const patchFlags = useCallback((ids, flag, add) => {
    const idSet = new Set(ids)
    const apply = (m) => {
      if (!idSet.has(m.id)) return m
      const f = new Set(m.flags || [])
      if (add) f.add(flag); else f.delete(flag)
      return { ...m, flags: [...f] }
    }
    setMessages((list) => list.map(apply))
    setOpenThread((t) => t ? { ...t, messages: t.messages.map(apply) } : t)
    setFullById((map) => {
      const next = { ...map }
      for (const id of ids) if (next[id]) next[id] = apply(next[id])
      return next
    })
  }, [])

  const removeIds = useCallback((ids) => {
    const idSet = new Set(ids)
    setMessages((list) => list.filter((m) => !idSet.has(m.id)))
  }, [])

  // ── Open / read ────────────────────────────────────────────────────────────
  const needBody = useCallback(async (id) => {
    if (fullById[id]?.__full) return
    try {
      const full = await client.getMessage(id, { folder: starredFolderSrc(folder) })
      setFullById((m) => ({ ...m, [id]: { ...full, __full: true } }))
      if (!(full.flags || []).includes(FLAG_SEEN)) {
        patchFlags([id], FLAG_SEEN, true)
        client.setFlag(id, FLAG_SEEN, true, { folder: starredFolderSrc(folder) }).catch(() => {})
      }
    } catch (e) { handleError(e) }
  }, [client, folder, fullById, patchFlags, handleError])

  const openThreadFn = useCallback((thread) => {
    setOpenThread(thread)
    setMobilePane('read')
    setFocusIdx(threads.findIndex((t) => t.id === thread.id))
    // Mark all unread messages in the thread read (optimistic).
    const unreadIds = thread.messages.filter((m) => !(m.flags || []).includes(FLAG_SEEN)).map((m) => m.id)
    if (unreadIds.length) {
      patchFlags(unreadIds, FLAG_SEEN, true)
      for (const id of unreadIds) client.setFlag(id, FLAG_SEEN, true, { folder: starredFolderSrc(folder) }).catch(() => {})
    }
  }, [threads, client, folder, patchFlags])

  // ── Targets helper: a passed thread, else the current selection ────────────
  const targetsOf = useCallback((thread) => {
    if (thread) return [thread]
    return threads.filter((t) => selection.has(t.id))
  }, [threads, selection])

  // When a triage action removes the open conversation, decide what happens to
  // the reading pane: advance to the next conversation (default, Superhuman-like)
  // or fall back to the list. Only fires when the open thread is actually removed.
  const advanceAfter = useCallback((targets) => {
    if (!openThread || !targets.some((t) => t.id === openThread.id)) return
    if (settings.autoAdvance === false) { setOpenThread(null); setMobilePane('list'); return }
    const removed = new Set(targets.map((t) => t.id))
    const i = threads.findIndex((t) => t.id === openThread.id)
    const next = threads.slice(i + 1).find((t) => !removed.has(t.id))
      || [...threads.slice(0, Math.max(0, i))].reverse().find((t) => !removed.has(t.id))
    pendingOpen.current = next ? next.id : '__none__'
  }, [openThread, threads, settings.autoAdvance])

  // ── Star ───────────────────────────────────────────────────────────────────
  const toggleStar = useCallback((thread, next) => {
    const targets = targetsOf(thread)
    for (const t of targets) {
      if (next) {
        patchFlags([t.latest.id], FLAG_FLAGGED, true)
        client.setFlag(t.latest.id, FLAG_FLAGGED, true, { folder: starredFolderSrc(folder) }).catch((e) => { handleError(e); loadList() })
      } else {
        const flaggedIds = t.messages.filter((m) => (m.flags || []).includes(FLAG_FLAGGED)).map((m) => m.id)
        patchFlags(flaggedIds, FLAG_FLAGGED, false)
        for (const id of flaggedIds) client.setFlag(id, FLAG_FLAGGED, false, { folder: starredFolderSrc(folder) }).catch((e) => { handleError(e); loadList() })
      }
    }
    if (!thread) setSelection(new Set())
  }, [targetsOf, patchFlags, client, folder, handleError, loadList])

  // ── Read / unread ────────────────────────────────────────────────────────
  const toggleRead = useCallback((thread, read) => {
    const targets = targetsOf(thread)
    const ids = targets.flatMap((t) => t.messages.map((m) => m.id))
    patchFlags(ids, FLAG_SEEN, read)
    for (const id of ids) client.setFlag(id, FLAG_SEEN, read, { folder: starredFolderSrc(folder) }).catch((e) => { handleError(e); loadList() })
    if (!thread) setSelection(new Set())
  }, [targetsOf, patchFlags, client, folder, handleError, loadList])

  // ── Delete (to Trash) ──────────────────────────────────────────────────────
  const deleteThreads = useCallback((thread) => {
    const targets = targetsOf(thread)
    if (!targets.length) return
    const ids = targets.flatMap((t) => t.messages.map((m) => m.id))
    const src = starredFolderSrc(folder)
    advanceAfter(targets)
    removeIds(ids)
    setSelection(new Set())
    undoable(
      `Deleted ${targets.length > 1 ? targets.length + ' conversations' : 'conversation'}`,
      () => { for (const id of ids) client.deleteMessage(id, { folder: src }).catch((e) => { handleError(e); loadList() }) },
      () => loadList(),
    )
  }, [targetsOf, removeIds, advanceAfter, client, folder, handleError, loadList, undoable])

  // ── Archive (move to Archive) ──────────────────────────────────────────────
  const archiveThreads = useCallback((thread) => {
    if (!canArchive) return
    const targets = targetsOf(thread)
    if (!targets.length) return
    const ids = targets.flatMap((t) => t.messages.map((m) => m.id))
    const src = starredFolderSrc(folder)
    advanceAfter(targets)
    removeIds(ids)
    setSelection(new Set())
    undoable(
      `Archived ${targets.length > 1 ? targets.length + ' conversations' : 'conversation'}`,
      () => {
        Promise.all(ids.map((id) => client.moveMessage(id, archiveFolder, { folder: src }))).catch((e) => {
          if (e instanceof ApiError && (e.status === 404 || e.status === 405)) {
            setMoveSupported(false)
            toast('Archive is not available on this server', 'error')
          } else {
            handleError(e)
          }
          loadList()
        })
      },
      () => loadList(),
    )
  }, [canArchive, targetsOf, removeIds, advanceAfter, client, archiveFolder, folder, handleError, loadList, toast, undoable])

  // ── Attachment download ────────────────────────────────────────────────────
  // Optional /v1 route; on 404/405 we disable the chips (capability probe),
  // mirroring archive. The actual save is a blob download — never innerHTML.
  const canDownload = attachmentsSupported && typeof client.downloadAttachment === 'function'
  const downloadAttachment = useCallback(async (uid, partId, filename) => {
    if (typeof client.downloadAttachment !== 'function') { setAttachmentsSupported(false); return }
    try {
      await client.downloadAttachment(uid, partId, filename)
    } catch (e) {
      if (e instanceof ApiError && (e.status === 404 || e.status === 405)) {
        setAttachmentsSupported(false)
        toast('Attachment download is not available on this server', 'error')
      } else {
        toast(handleError(e), 'error')
      }
    }
  }, [client, toast, handleError])

  // ── Selection ──────────────────────────────────────────────────────────────
  const toggleSelect = useCallback((id) => {
    setSelection((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }, [])
  const selectRange = useCallback((ids) => {
    setSelection((s) => { const n = new Set(s); for (const id of ids) n.add(id); return n })
  }, [])
  const selectAll = useCallback((on) => {
    setSelection(on ? new Set(threads.map((t) => t.id)) : new Set())
  }, [threads])

  // ── Compose ────────────────────────────────────────────────────────────────
  const openCompose = useCallback((initial = {}) => {
    setComposes((c) => [...c, { id: ++composeSeq, initial }])
  }, [])
  const closeCompose = useCallback((id) => setComposes((c) => c.filter((x) => x.id !== id)), [])

  const replyTo = useCallback((message, mode) => {
    const base = (message.subject || '').replace(/^\s*(re|fwd?|aw)\s*:\s*/i, '')
    if (mode === 'forward') {
      openCompose({ subject: 'Fwd: ' + base, html: quoteForward(message) })
    } else {
      openCompose({
        to: message.from,
        cc: mode === 'replyAll' ? replyAllCc(message, me?.email) : '',
        subject: 'Re: ' + base,
        html: quoteReply(message),
        inReplyTo: message.messageId,
        references: [...(message.references || []), message.messageId].filter(Boolean),
      })
    }
  }, [openCompose, me])

  // ── Folder / search nav ────────────────────────────────────────────────────
  const selectFolder = useCallback((f) => {
    setFolder(f); setQuery(''); setOpenThread(null); setSelection(new Set())
    setMobilePane('list'); setDrawerOpen(false); setPanel('none'); setFocusIdx(-1)
  }, [])
  const runSearch = useCallback((q) => { setQuery(q); setOpenThread(null); setMobilePane('list'); setFocusIdx(-1) }, [])
  const clearSearch = useCallback(() => { setQuery(''); setOpenThread(null); setFocusIdx(-1) }, [])

  // Resolve a `g …` chord destination (or palette "Go to" item) to a real
  // mailbox path; returns null when the account has no such folder.
  const specialPath = useCallback((kind) => {
    if (kind === 'inbox') return 'INBOX'
    if (kind === 'starred') return STARRED_FOLDER
    const f = folders.find((x) => classifyFolder(x) === kind)
    return f ? (f.path ?? f.name) : null
  }, [folders])
  const gotoFolder = useCallback((dest) => {
    const path = specialPath(dest)
    if (path) selectFolder(path)
  }, [specialPath, selectFolder])

  const togglePanel = useCallback((name) => setPanel((p) => (p === name ? 'none' : name)), [])

  // The persistent right-hand calendar side panel (separate from the wide
  // overlay panel). Show/hide + expanded state persist via useSettings.
  const calendarAvailable = typeof client.listEvents === 'function'
  const showCalPanel = settings.calendarPanel !== false && calendarAvailable

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  const moveFocus = useCallback((delta) => {
    setFocusIdx((i) => {
      const n = Math.max(0, Math.min(threads.length - 1, (i < 0 ? 0 : i + delta)))
      return n
    })
  }, [threads.length])

  const kbHandlers = useMemo(() => ({
    next: () => moveFocus(1),
    prev: () => moveFocus(-1),
    open: () => { const t = threads[focusIdx]; if (t) openThreadFn(t) },
    back: () => { setOpenThread(null); setMobilePane('list') },
    archive: () => { const t = openThread || threads[focusIdx]; if (t) archiveThreads(t) },
    delete: () => { const t = openThread || threads[focusIdx]; if (t) deleteThreads(t) },
    star: () => { const t = openThread || threads[focusIdx]; if (t) toggleStar(t, !t.starred) },
    select: () => { const t = threads[focusIdx]; if (t) toggleSelect(t.id) },
    reply: () => { const t = openThread; if (t) replyTo(fullById[t.latest.id] || t.latest, 'reply') },
    replyAll: () => { const t = openThread; if (t) replyTo(fullById[t.latest.id] || t.latest, 'replyAll') },
    forward: () => { const t = openThread; if (t) replyTo(fullById[t.latest.id] || t.latest, 'forward') },
    compose: () => openCompose(),
    search: () => searchRef.current?.focus(),
    help: () => setHelpOpen(true),
    palette: () => setPaletteOpen(true),
    undo: undoLast,
    goto: gotoFolder,
    escape: () => {
      if (paletteOpen) setPaletteOpen(false)
      else if (helpOpen) setHelpOpen(false)
      else if (composes.length) closeCompose(composes[composes.length - 1].id)
      else if (panel !== 'none') setPanel('none')
      else if (openThread) { setOpenThread(null); setMobilePane('list') }
    },
  }), [threads, focusIdx, openThread, fullById, moveFocus, openThreadFn, archiveThreads, deleteThreads, toggleStar, toggleSelect, replyTo, openCompose, undoLast, gotoFolder, helpOpen, paletteOpen, panel, composes, closeCompose])

  useKeyboard(kbHandlers, settings.shortcuts)

  const contactSearch = useCallback((q) => client.listContacts({ q, limit: 6 }).catch(() => []), [client])

  // ── Command palette (⌘K) ────────────────────────────────────────────────────
  // A flat, fuzzy-searchable dispatch table over the handlers above. Every entry
  // is a real, wired action — nothing here is a placeholder.
  const commands = useMemo(() => {
    const cmds = []
    const cur = openThread || threads[focusIdx] || null

    // Go to — mailboxes that actually exist on this account, then user labels.
    const go = (id, title, icon, path) => { if (path) cmds.push({ id: 'go-' + id, section: 'Go to', title, icon, keywords: 'mailbox folder', run: () => selectFolder(path) }) }
    go('inbox', 'Inbox', 'inbox', 'INBOX')
    go('starred', 'Starred', 'star', STARRED_FOLDER)
    go('sent', 'Sent', 'send', specialPath('sent'))
    go('drafts', 'Drafts', 'draft', specialPath('drafts'))
    go('archive', 'Archive', 'archive', archiveFolder)
    go('junk', 'Spam', 'shield', specialPath('junk'))
    go('trash', 'Trash', 'trash', trashFolder)
    for (const l of labels) {
      cmds.push({ id: 'label-' + l.path, section: 'Go to', title: l.label, dot: labelHue(l.path), keywords: 'label ' + l.path, run: () => selectFolder(l.path) })
    }

    // This conversation — only when one is focused/open.
    if (cur) {
      const full = fullById[cur.latest.id] || cur.latest
      if (canArchive) cmds.push({ id: 'c-archive', section: 'This conversation', title: 'Archive', icon: 'archive', keys: ['e'], run: () => archiveThreads(cur) })
      cmds.push({ id: 'c-delete', section: 'This conversation', title: 'Delete', icon: 'trash', keys: ['#'], run: () => deleteThreads(cur) })
      cmds.push({ id: 'c-star', section: 'This conversation', title: cur.starred ? 'Unstar' : 'Star', icon: 'star', keys: ['s'], run: () => toggleStar(cur, !cur.starred) })
      cmds.push({ id: 'c-read', section: 'This conversation', title: cur.unread ? 'Mark as read' : 'Mark as unread', icon: cur.unread ? 'mailopen' : 'mail', run: () => toggleRead(cur, cur.unread) })
      cmds.push({ id: 'c-reply', section: 'This conversation', title: 'Reply', icon: 'reply', keys: ['r'], run: () => replyTo(full, 'reply') })
      cmds.push({ id: 'c-replyall', section: 'This conversation', title: 'Reply all', icon: 'replyall', keys: ['a'], run: () => replyTo(full, 'replyAll') })
      cmds.push({ id: 'c-forward', section: 'This conversation', title: 'Forward', icon: 'forward', keys: ['f'], run: () => replyTo(full, 'forward') })
    }

    // Actions.
    cmds.push({ id: 'a-compose', section: 'Actions', title: 'Compose new message', icon: 'pencil', keys: ['c'], keywords: 'new write email', run: () => openCompose() })
    cmds.push({ id: 'a-search', section: 'Actions', title: 'Search mail', icon: 'search', keys: ['/'], run: () => setTimeout(() => searchRef.current?.focus(), 0) })
    cmds.push({ id: 'a-refresh', section: 'Actions', title: 'Refresh', icon: 'refresh', run: () => loadList() })

    // View — instantly-applied appearance preferences.
    cmds.push({ id: 'v-theme', section: 'View', title: resolvedTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme', icon: resolvedTheme === 'dark' ? 'sun' : 'moon', keywords: 'appearance dark light mode', run: () => setSettings({ theme: resolvedTheme === 'dark' ? 'light' : 'dark' }) })
    cmds.push({ id: 'v-density', section: 'View', title: settings.density === 'compact' ? 'Comfortable density' : 'Compact density', icon: settings.density === 'compact' ? 'list' : 'menu', keywords: 'spacing rows', run: () => setSettings({ density: settings.density === 'compact' ? 'comfortable' : 'compact' }) })
    cmds.push({ id: 'v-threaded', section: 'View', title: settings.threaded ? 'Turn off conversation view' : 'Turn on conversation view', icon: 'layers', keywords: 'thread group', run: () => setSettings((s) => ({ threaded: !s.threaded })) })

    // Panels.
    cmds.push({ id: 'p-settings', section: 'Panels', title: 'Settings', icon: 'settings', run: () => setPanel('settings') })
    cmds.push({ id: 'p-contacts', section: 'Panels', title: 'Contacts', icon: 'users', run: () => setPanel('contacts') })
    if (calendarAvailable) cmds.push({ id: 'p-calendar', section: 'Panels', title: 'Calendar', icon: 'calendar', run: () => setPanel('calendar') })
    cmds.push({ id: 'p-help', section: 'Panels', title: 'Keyboard shortcuts', icon: 'keyboard', keys: ['?'], run: () => setHelpOpen(true) })

    return cmds
  }, [openThread, threads, focusIdx, fullById, labels, canArchive, archiveFolder, trashFolder, specialPath, calendarAvailable, resolvedTheme, settings.density, settings.threaded, selectFolder, archiveThreads, deleteThreads, toggleStar, toggleRead, replyTo, openCompose, loadList, setSettings])

  return (
    <div
      ref={rootRef}
      className="vm-app"
      data-theme={resolvedTheme}
      data-density={settings.density}
      data-rp={settings.readingPane}
      data-open={openThread ? '1' : '0'}
      data-pane={mobilePane}
      data-drawer={drawerOpen ? '1' : '0'}
      data-panel-open={panel !== 'none' ? '1' : '0'}
      data-calpanel={showCalPanel ? (settings.calendarExpanded ? 'expanded' : '1') : '0'}
      data-preview={settings.preview === false ? '0' : '1'}
    >
      {drawerOpen && <div className="vm-scrim" onClick={() => setDrawerOpen(false)} aria-hidden="true" />}

      <FolderList
        folders={folders}
        current={folder}
        me={me}
        quota={quota}
        collapsed={railCollapsed}
        starredCount={starredCount}
        onToggleCollapse={() => setRailCollapsed((v) => !v)}
        onSelect={selectFolder}
        onCompose={() => openCompose()}
        onManageLabels={() => { setPanel('settings'); setDrawerOpen(false) }}
        onOpenPanel={(name) => { setPanel(name); setDrawerOpen(false) }}
        onOpenHelp={() => { setHelpOpen(true); setDrawerOpen(false) }}
      />

      <div className="vm-main">
        <MessageList
          threads={threads}
          selectedId={openThread?.id ?? null}
          focusId={threads[focusIdx]?.id ?? null}
          selection={selection}
          onToggleSelect={toggleSelect}
          onSelectRange={selectRange}
          onSelectAll={selectAll}
          onOpen={openThreadFn}
          onCompose={() => openCompose()}
          onToggleStar={toggleStar}
          onArchive={archiveThreads}
          onDelete={deleteThreads}
          onToggleRead={toggleRead}
          onRefresh={loadList}
          loading={listLoading}
          error={listError}
          onRetry={loadList}
          query={query}
          onSearch={runSearch}
          onClearSearch={clearSearch}
          canArchive={canArchive}
          folder={folder}
          searchRef={searchRef}
          onMenu={() => setDrawerOpen(true)}
        />

        <MessageView
          thread={openThread}
          fullById={fullById}
          onNeedBody={needBody}
          canArchive={canArchive}
          attachmentsSupported={canDownload}
          onDownloadAttachment={downloadAttachment}
          onToggleStar={(next) => openThread && toggleStar(openThread, next)}
          onArchive={() => openThread && archiveThreads(openThread)}
          onDelete={() => openThread && deleteThreads(openThread)}
          onReply={(m) => replyTo(m, 'reply')}
          onReplyAll={(m) => replyTo(m, 'replyAll')}
          onForward={(m) => replyTo(m, 'forward')}
          onBack={() => { setOpenThread(null); setMobilePane('list') }}
        />
      </div>

      {/* Persistent right-hand calendar side panel (desktop; hidden ≤1200px). */}
      {showCalPanel && (
        <CalendarPanel
          client={client}
          onAuthError={onAuthError}
          expanded={settings.calendarExpanded}
          onToggleExpand={() => setSettings((s) => ({ calendarExpanded: !s.calendarExpanded }))}
          onHide={() => setSettings({ calendarPanel: false })}
        />
      )}

      {/* Far-right app rail (Gmail-style side panel toggles). */}
      <aside className="vm-rightrail" aria-label="Side panels">
        {calendarAvailable && (
          <button type="button" className={'vm-iconbtn' + (showCalPanel ? ' vm-on' : '')} aria-label="Calendar" title={showCalPanel ? 'Hide calendar' : 'Show calendar'} onClick={() => setSettings((s) => ({ calendarPanel: !(s.calendarPanel !== false) }))}><Icon name="calendar" /></button>
        )}
        <button type="button" className={'vm-iconbtn' + (panel === 'contacts' ? ' vm-on' : '')} aria-label="Contacts" title="Contacts" onClick={() => togglePanel('contacts')}><Icon name="users" /></button>
        <button type="button" className={'vm-iconbtn' + (panel === 'settings' ? ' vm-on' : '')} aria-label="Settings" title="Settings" onClick={() => togglePanel('settings')}><Icon name="settings" /></button>
        <span className="vm-spacer" />
        <button type="button" className="vm-iconbtn" aria-label="Keyboard shortcuts" title="Keyboard shortcuts" onClick={() => setHelpOpen(true)}><Icon name="keyboard" /></button>
      </aside>

      {panel !== 'none' && (
        <aside className="vm-panel" aria-label={panel}>
          {panel === 'settings' && <Settings settings={settings} onChange={setSettings} onClose={() => setPanel('none')} extra={settingsExtra} labels={labels} quota={quota} onShowShortcuts={() => { setHelpOpen(true); setPanel('none') }} />}
          {panel === 'calendar' && (
            <div className="vm-panel-embed">
              <div className="vm-panel-head"><h2><Icon name="calendar" className="vm-icon" /> Calendar</h2><button type="button" className="vm-iconbtn" aria-label="Close" onClick={() => setPanel('none')}><Icon name="close" /></button></div>
              <Calendar client={client} defaultView="agenda" onAuthError={onAuthError} />
            </div>
          )}
          {panel === 'contacts' && (
            <div className="vm-panel-embed">
              <div className="vm-panel-head"><h2><Icon name="users" className="vm-icon" /> Contacts</h2><button type="button" className="vm-iconbtn" aria-label="Close" onClick={() => setPanel('none')}><Icon name="close" /></button></div>
              <Contacts client={client} onSelect={(c) => { openCompose({ to: c.email }); setPanel('none') }} onAuthError={onAuthError} />
            </div>
          )}
        </aside>
      )}

      {/* Mobile compose FAB. */}
      <button type="button" className="vm-fab" aria-label="Compose" onClick={() => openCompose()}><Icon name="pencil" /></button>

      <div className="vm-compose-stack">
        {composes.map((c, i) => (
          <div key={c.id} className="vm-compose-slot" style={{ '--slot': i }}>
            <Compose
              initial={c.initial}
              signature={settings.signature}
              onContactSearch={contactSearch}
              onSaveDraft={(d) => client.saveDraft(d)}
              onSend={async (d) => { await sendDraft(d); toast('Message sent', 'success'); loadList() }}
              onClose={() => closeCompose(c.id)}
            />
          </div>
        ))}
      </div>

      {paletteOpen && <CommandPalette commands={commands} onClose={() => setPaletteOpen(false)} />}

      {helpOpen && <ShortcutsHelp onClose={() => setHelpOpen(false)} />}

      <div className="vm-toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={'vm-toast vm-toast-' + t.kind}>
            <span className="vm-toast-text">{t.text}</span>
            {t.undo && <button type="button" className="vm-toast-action" onClick={t.undo}>Undo</button>}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Starred is a virtual view over INBOX; map it back to a real source folder. */
function starredFolderSrc(folder) {
  return folder === STARRED_FOLDER ? 'INBOX' : folder
}

/** Stable hue 0..359 from a label path, matching FolderList's colour dots. */
function labelHue(seed = '') {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360
  return h
}
