import { useEffect, useId, useRef, useState } from 'react'
import Icon from './Icon.jsx'

/**
 * <Menu/> — a small accessible dropdown (popover) anchored to a trigger button.
 *
 * Keyboard: Enter/Space or ↓ opens; ↑/↓ move the active item; Enter/Space
 * selects; Escape (or a click outside) closes and returns focus to the trigger.
 * Items are `{ id, label, sub?, icon?, dot?, checked?, danger?, onSelect }`.
 *
 * Purely presentational + interaction — callers own the actions. Used for the
 * reading-pane Snooze / Label menus (wave3), styled with the shared vm- tokens.
 */
export default function Menu({
  triggerIcon = 'more', triggerLabel = 'More', triggerClassName = 'vm-iconbtn',
  items = [], align = 'right', header,
  onOpenChange,
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const wrapRef = useRef(null)
  const triggerRef = useRef(null)
  const listRef = useRef(null)
  const menuId = useId()

  const enabled = items.filter((it) => !it.disabled)

  const close = (returnFocus = true) => {
    setOpen(false)
    setActive(-1)
    if (returnFocus) triggerRef.current?.focus()
  }

  useEffect(() => { onOpenChange?.(open) }, [open])  // eslint-disable-line react-hooks/exhaustive-deps

  // Close on outside click / focus escape.
  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) close(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  // Move DOM focus onto the active item so screen readers track it.
  useEffect(() => {
    if (!open || active < 0) return
    const el = listRef.current?.querySelectorAll('[role="menuitem"]')?.[active]
    el?.focus()
  }, [open, active])

  function openMenu(toIndex = 0) {
    setOpen(true)
    setActive(toIndex)
  }

  function onTriggerKeyDown(e) {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault(); openMenu(0)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault(); openMenu(enabled.length - 1)
    }
  }

  function onListKeyDown(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % enabled.length); return }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a - 1 + enabled.length) % enabled.length); return }
    if (e.key === 'Home') { e.preventDefault(); setActive(0); return }
    if (e.key === 'End') { e.preventDefault(); setActive(enabled.length - 1); return }
    if (e.key === 'Tab') { close(false) }
  }

  function select(item) {
    close()
    item.onSelect?.()
  }

  return (
    <div className="vm-menu-wrap" ref={wrapRef}>
      <button
        type="button"
        ref={triggerRef}
        className={triggerClassName + (open ? ' vm-on' : '')}
        aria-label={triggerLabel}
        title={triggerLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => (open ? close() : openMenu(0))}
        onKeyDown={onTriggerKeyDown}
      >
        <Icon name={triggerIcon} />
      </button>

      {open && (
        <div
          className={'vm-menu vm-menu-' + align}
          role="menu"
          id={menuId}
          aria-label={triggerLabel}
          ref={listRef}
          onKeyDown={onListKeyDown}
        >
          {header && <div className="vm-menu-header">{header}</div>}
          {enabled.map((it, i) => (
            <button
              key={it.id}
              type="button"
              role="menuitem"
              tabIndex={-1}
              className={'vm-menu-item' + (i === active ? ' vm-on' : '') + (it.danger ? ' vm-danger' : '')}
              onClick={() => select(it)}
              onMouseEnter={() => setActive(i)}
            >
              {it.dot != null
                ? <span className="vm-label-dot" style={{ background: `hsl(${it.dot} 55% 55%)` }} aria-hidden="true" />
                : it.icon ? <Icon name={it.icon} className="vm-menu-item-ico" /> : <span className="vm-menu-item-ico" />}
              <span className="vm-menu-item-label">{it.label}</span>
              {it.sub && <span className="vm-menu-item-sub">{it.sub}</span>}
              {it.checked && <Icon name="check" className="vm-menu-item-check" />}
            </button>
          ))}
          {enabled.length === 0 && <div className="vm-menu-empty">Nothing here</div>}
        </div>
      )}
    </div>
  )
}
