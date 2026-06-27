/**
 * useSettings.js — localStorage-persisted UI preferences.
 *
 * Covers appearance (theme, density), layout (reading-pane position, inbox type,
 * conversation threading, message-list preview), the right-hand calendar panel
 * (show/hide + expanded), desktop notifications, the keyboard-shortcuts toggle
 * and the compose signature. All values are purely client-side preferences; any
 * server-backed surface (account, filters, vacation…) is supplied by the host.
 */
import { useCallback, useEffect, useState } from 'react'

const KEY = 'vulos-mail.settings.v1'

export const DEFAULT_SETTINGS = {
  density: 'comfortable',     // 'comfortable' | 'compact'
  readingPane: 'right',       // 'right' | 'bottom' | 'off'
  theme: 'system',            // 'system' (follow OS) | 'dark' | 'light'
  inboxType: 'default',       // 'default' | 'unread' | 'starred' (client-side sort)
  preview: true,              // show the snippet preview line in the list
  shortcuts: true,
  threaded: true,
  notifications: false,       // desktop notifications (browser Notification API)
  calendarPanel: true,        // show the right-hand calendar side panel (desktop)
  calendarExpanded: false,    // calendar panel: mini agenda vs full month
  signature: '',
}

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function useSettings() {
  const [settings, setSettings] = useState(load)

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(settings)) } catch { /* ignore */ }
  }, [settings])

  const set = useCallback((patch) => {
    setSettings((s) => ({ ...s, ...(typeof patch === 'function' ? patch(s) : patch) }))
  }, [])

  return [settings, set]
}
