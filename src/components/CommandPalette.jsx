import { useEffect, useMemo, useRef, useState } from 'react'
import Icon from './Icon.jsx'

/**
 * fuzzyScore — subsequence match with contiguity + word-boundary bonuses.
 *
 * Returns a positive score when every character of `query` appears in `text`
 * in order (higher = better), or 0 when there is no match. Empty query matches
 * everything with a neutral score so the full command list renders. This is the
 * same feel as Superhuman / Linear / VS Code's palette — type a few letters and
 * the best command floats to the top.
 */
export function fuzzyScore(text = '', query = '') {
  if (!query) return 1
  const t = text.toLowerCase()
  const q = query.toLowerCase()
  let ti = 0
  let score = 0
  let streak = 0
  for (let qi = 0; qi < q.length; qi++) {
    const c = q[qi]
    let found = -1
    for (let i = ti; i < t.length; i++) {
      if (t[i] === c) { found = i; break }
    }
    if (found === -1) return 0
    // Contiguous matches and matches at a word boundary score higher.
    if (found === ti) streak += 1
    else streak = 0
    let pt = 1 + streak
    const prev = t[found - 1]
    if (found === 0 || prev === ' ' || prev === '/' || prev === '·') pt += 3
    score += pt
    ti = found + 1
  }
  // Prefer shorter targets (a tight match beats the same letters buried in noise).
  return score + Math.max(0, 12 - t.length) * 0.1
}

/**
 * <CommandPalette/> — ⌘K fuzzy command bar.
 *
 * A single keyboard-driven surface for everything: jump to any mailbox/label,
 * run an action on the current conversation, compose, toggle appearance, or
 * open a side panel. Purely a dispatcher over the same handlers the rest of the
 * app already uses — it introduces no new capability, just makes every one of
 * them reachable in two keystrokes without touching the mouse.
 *
 * @param {object} props
 * @param {Array<Command>} props.commands - flat command list (built by MailApp).
 * @param {()=>void} props.onClose
 */
export default function CommandPalette({ commands = [], onClose }) {
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const results = useMemo(() => {
    const scored = []
    for (const c of commands) {
      if (c.disabled) continue
      const hay = c.keywords ? `${c.title} ${c.keywords}` : c.title
      const s = fuzzyScore(hay, q)
      if (s > 0) scored.push({ c, s })
    }
    scored.sort((a, b) => b.s - a.s)
    return scored.map((x) => x.c)
  }, [commands, q])

  // Keep the active index in range and scrolled into view as results change.
  useEffect(() => { setActive(0) }, [q])
  useEffect(() => {
    const el = listRef.current?.querySelector('[data-active="1"]')
    el?.scrollIntoView({ block: 'nearest' })
  }, [active, results])

  const run = (cmd) => { if (!cmd) return; onClose?.(); cmd.run?.() }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); run(results[active]) }
    else if (e.key === 'Escape') { e.preventDefault(); onClose?.() }
    else if (e.key === 'Tab') { e.preventDefault(); setActive((a) => (e.shiftKey ? Math.max(a - 1, 0) : Math.min(a + 1, results.length - 1))) }
  }

  // Group the (already fuzzy-ranked) results by section for a scannable list,
  // while preserving overall rank order between sections.
  const groups = useMemo(() => {
    const order = []
    const bySection = new Map()
    results.forEach((c, i) => {
      const sec = c.section || 'Commands'
      if (!bySection.has(sec)) { bySection.set(sec, []); order.push(sec) }
      bySection.get(sec).push({ c, i })
    })
    return order.map((sec) => ({ sec, items: bySection.get(sec) }))
  }, [results])

  return (
    <div className="vm-overlay vm-cmdk-overlay" role="dialog" aria-modal="true" aria-label="Command palette"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.() }}>
      <div className="vm-cmdk" onKeyDown={onKeyDown}>
        <div className="vm-cmdk-search">
          <Icon name="search" className="vm-icon" />
          <input
            ref={inputRef}
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Type a command or search…"
            aria-label="Command"
            aria-controls="vm-cmdk-list"
            autoComplete="off"
            spellCheck="false"
          />
          <kbd className="vm-cmdk-hint">esc</kbd>
        </div>

        {results.length === 0 ? (
          <div className="vm-cmdk-empty">No matching commands</div>
        ) : (
          <ul className="vm-cmdk-list" id="vm-cmdk-list" ref={listRef} role="listbox">
            {groups.map((g) => (
              <li key={g.sec} className="vm-cmdk-group">
                <div className="vm-cmdk-section" aria-hidden="true">{g.sec}</div>
                <ul>
                  {g.items.map(({ c, i }) => (
                    <li
                      key={c.id}
                      role="option"
                      aria-selected={i === active}
                      data-active={i === active ? '1' : '0'}
                      className={'vm-cmdk-item' + (i === active ? ' vm-on' : '')}
                      onMouseMove={() => setActive(i)}
                      onMouseDown={(e) => { e.preventDefault(); run(c) }}
                    >
                      <span className="vm-cmdk-ico">{c.dot != null
                        ? <span className="vm-label-dot" style={{ background: `hsl(${c.dot} 55% 55%)` }} aria-hidden="true" />
                        : <Icon name={c.icon || 'chevright'} />}</span>
                      <span className="vm-cmdk-title">{c.title}</span>
                      {c.hint && <span className="vm-cmdk-meta">{c.hint}</span>}
                      {c.keys && <span className="vm-cmdk-keys">{c.keys.map((k) => <kbd key={k}>{k}</kbd>)}</span>}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

/**
 * @typedef {object} Command
 * @property {string} id
 * @property {string} title
 * @property {string} [section]
 * @property {string} [icon]
 * @property {number} [dot]      - label hue (used instead of an icon)
 * @property {string} [hint]     - trailing muted text (e.g. unread count)
 * @property {string[]} [keys]   - trailing key hints
 * @property {string} [keywords] - extra fuzzy-match terms
 * @property {boolean} [disabled]
 * @property {()=>void} [run]
 */
