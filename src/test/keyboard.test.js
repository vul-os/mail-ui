import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { keyToAction, useKeyboard } from '../components/useKeyboard.js'

const ev = (key, mods = {}) => ({ key, altKey: false, ctrlKey: false, metaKey: false, ...mods })

afterEach(() => { document.body.innerHTML = '' })

function fireKey(target, key) {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
}

describe('keyToAction', () => {
  it('maps the Gmail navigation + action keys', () => {
    const cases = {
      j: 'next', k: 'prev', o: 'open', Enter: 'open', u: 'back',
      e: 'archive', '#': 'delete', r: 'reply', a: 'replyAll', f: 'forward',
      c: 'compose', s: 'star', x: 'select', '/': 'search', '?': 'help', Escape: 'escape',
    }
    for (const [key, action] of Object.entries(cases)) {
      expect(keyToAction(ev(key))).toBe(action)
    }
  })

  it('ignores keys with modifiers (so browser shortcuts still work)', () => {
    expect(keyToAction(ev('j', { metaKey: true }))).toBeNull()
    expect(keyToAction(ev('c', { ctrlKey: true }))).toBeNull()
    expect(keyToAction(ev('a', { altKey: true }))).toBeNull()
  })

  it('maps the triage + navigation extras (undo, go-to chord)', () => {
    expect(keyToAction(ev('z'))).toBe('undo')
    expect(keyToAction(ev('g'))).toBe('goto')
  })

  it('returns null for unmapped keys', () => {
    expect(keyToAction(ev('1'))).toBeNull()
    expect(keyToAction(ev('q'))).toBeNull()
  })
})

describe('useKeyboard', () => {
  it('ignores Enter "open" when focus is on an interactive control (no double-fire)', () => {
    const open = vi.fn()
    renderHook(() => useKeyboard({ open }, true))

    const btn = document.createElement('button')
    document.body.appendChild(btn)
    fireKey(btn, 'Enter')
    expect(open).not.toHaveBeenCalled()

    // Enter from a non-interactive element still opens the focused thread.
    const div = document.createElement('div')
    document.body.appendChild(div)
    fireKey(div, 'Enter')
    expect(open).toHaveBeenCalledTimes(1)
  })

  it('honours Escape even from inside an editable field', () => {
    const escape = vi.fn()
    renderHook(() => useKeyboard({ escape }, true))
    const input = document.createElement('input')
    document.body.appendChild(input)
    fireKey(input, 'Escape')
    expect(escape).toHaveBeenCalledTimes(1)
  })

  it('dispatches a `g i` chord to goto("inbox")', () => {
    const goto = vi.fn()
    renderHook(() => useKeyboard({ goto }, true))
    fireKey(document.body, 'g')
    expect(goto).not.toHaveBeenCalled() // armed, awaiting the destination key
    fireKey(document.body, 'i')
    expect(goto).toHaveBeenCalledWith('inbox')
  })

  it('does not fire goto for an unknown second chord key', () => {
    const goto = vi.fn()
    renderHook(() => useKeyboard({ goto }, true))
    fireKey(document.body, 'g')
    fireKey(document.body, 'q')
    expect(goto).not.toHaveBeenCalled()
  })

  it('opens the palette on ⌘K / Ctrl-K, even while typing', () => {
    const palette = vi.fn()
    renderHook(() => useKeyboard({ palette }, true))
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true, cancelable: true }))
    expect(palette).toHaveBeenCalledTimes(1)
  })

  it('maps `z` to undo', () => {
    const undo = vi.fn()
    renderHook(() => useKeyboard({ undo }, true))
    fireKey(document.body, 'z')
    expect(undo).toHaveBeenCalledTimes(1)
  })
})
