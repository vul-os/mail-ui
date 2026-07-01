/**
 * useKeyboard.js — Gmail-style keyboard shortcuts.
 *
 * `keyToAction` is a pure mapping from a KeyboardEvent to an action name (or null)
 * so it can be unit-tested in isolation; `useKeyboard` wires it to window and
 * dispatches into a handler map. Typing in inputs/textareas/contenteditable is
 * never hijacked (except Escape and "/" focus-search semantics).
 *
 * Beyond the single-key actions, two multi-key affordances give the client its
 * Superhuman/Linear feel:
 *   • `g` then a mailbox key (i/s/t/d/a) — "go to" folder chords.
 *   • ⌘K / Ctrl-K — the command palette (works everywhere, even while typing).
 */
import { useEffect, useRef } from 'react'

/** Map a keyboard event to a Gmail-like action name, or null to ignore. */
export function keyToAction(e) {
  if (e.altKey || e.ctrlKey || e.metaKey) return null
  const k = e.key
  switch (k) {
    case 'j': return 'next'
    case 'k': return 'prev'
    case 'o': return 'open'
    case 'Enter': return 'open'
    case 'u': return 'back'
    case 'e': return 'archive'
    case '#': return 'delete'
    case 'r': return 'reply'
    case 'a': return 'replyAll'
    case 'f': return 'forward'
    case 'c': return 'compose'
    case 's': return 'star'
    case 'x': return 'select'
    case 'z': return 'undo'
    case 'g': return 'goto'
    case '/': return 'search'
    case '?': return 'help'
    case 'Escape': return 'escape'
    default: return null
  }
}

/** Second key of a `g …` chord → a folder-navigation destination. */
const GOTO = {
  i: 'inbox',
  s: 'starred',
  t: 'sent',
  d: 'drafts',
  a: 'archive',
}

/** How long a `g` prefix stays armed waiting for the second key. */
const CHORD_MS = 900

/** Resolve the second key of a `g …` chord to a destination, or null. */
export function chordDest(key) {
  return GOTO[key] ?? null
}

/** True when the event originates from an editable element. */
function isEditable(t) {
  if (!t) return false
  const tag = t.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable
}

/** True for native/ARIA interactive controls that handle their own activation. */
function isInteractive(t) {
  if (!t) return false
  const tag = t.tagName
  return tag === 'BUTTON' || tag === 'A' || tag === 'SUMMARY' || t.getAttribute?.('role') === 'button'
}

/**
 * Wire keyboard shortcuts.
 * @param {Record<string, (arg?: any) => void>} handlers - action → callback.
 *   Special handlers: `goto(dest)` receives a mailbox name, `palette()` opens the
 *   command palette (bound to ⌘K / Ctrl-K).
 * @param {boolean} enabled
 */
export function useKeyboard(handlers, enabled = true) {
  // Timestamp of a pending `g` prefix; null when no chord is armed. A ref (not
  // state) so arming the chord never triggers a re-render.
  const chordAt = useRef(0)

  useEffect(() => {
    if (!enabled) return undefined
    const onKey = (e) => {
      // ⌘K / Ctrl-K — the command palette. Global: fires even while typing so it
      // is always one keystroke away, matching Superhuman / Linear / VS Code.
      if ((e.metaKey || e.ctrlKey) && !e.altKey && (e.key === 'k' || e.key === 'K')) {
        if (handlers.palette) { e.preventDefault(); chordAt.current = 0; handlers.palette() }
        return
      }

      const editing = isEditable(e.target)

      // Second key of an armed `g …` chord (never while typing).
      if (chordAt.current && !editing && !e.altKey && !e.ctrlKey && !e.metaKey) {
        const fresh = Date.now() - chordAt.current < CHORD_MS
        chordAt.current = 0
        const dest = chordDest(e.key)
        if (fresh && dest && handlers.goto) { e.preventDefault(); handlers.goto(dest); return }
        // Stale or unknown → fall through and treat this key normally.
      }

      const action = keyToAction(e)
      if (!action) return
      // In editable fields, only Escape is honoured (e.g. close compose/help).
      if (editing && action !== 'escape') return
      // "open" (Enter / o) on a focused control would double-fire alongside the
      // control's own activation — let the button/link/row handle it itself.
      if (action === 'open' && isInteractive(e.target)) return

      // Arm the `g` prefix and wait for the destination key.
      if (action === 'goto') {
        if (handlers.goto) { e.preventDefault(); chordAt.current = Date.now() }
        return
      }

      const fn = handlers[action]
      if (fn) {
        // These would otherwise type into a just-focused control or scroll.
        if (action === 'search' || action === 'help' || action === 'delete') e.preventDefault()
        fn(e)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handlers, enabled])
}
