/**
 * sanitize.js — single source of truth for HTML email sanitisation.
 *
 * Email HTML is hostile by default, so we run every body through DOMPurify with
 * a strict allow-list: no scripts, iframes, forms, or inline event handlers, and
 * links are forced to open in a new tab with `rel="noopener noreferrer"`.
 *
 * Privacy: remote content (external <img>/media, CSS background images) is
 * neutralised by default so opening a message can't phone home / load tracking
 * pixels. Callers opt in per-message via { allowRemote: true } once the reader
 * clicks "Load remote images".
 */

import DOMPurify from 'dompurify'

const FORBID_EVENT_ATTR = [
  'onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur',
  'onchange', 'onsubmit', 'onkeydown', 'onkeyup', 'onkeypress', 'onanimationstart',
]

export const EMAIL_HTML_CONFIG = {
  USE_PROFILES: { html: true },
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'style', 'link', 'meta', 'base'],
  FORBID_ATTR: FORBID_EVENT_ATTR,
  ALLOW_DATA_ATTR: false,
}

// Matches absolute (http/https) and protocol-relative URLs — i.e. anything that
// would cause the browser to fetch from a remote host. data: and cid: URIs are
// intentionally left alone (inline/embedded content, not a network beacon).
const REMOTE_URL = /^\s*(?:https?:)?\/\//i
const REMOTE_IN_STYLE = /url\(\s*['"]?\s*(?:https?:)?\/\/[^)]*\)/gi

// DOMPurify hooks are global, so the active call's options + observed state ride
// on module scope. JS is single-threaded and DOMPurify.sanitize is synchronous,
// so there's no interleaving between set → sanitize → read.
let activeAllowRemote = false
let sawRemote = false

// Harden anchors + neutralise remote content once per module load.
let hooked = false
function ensureHook() {
  if (hooked || typeof DOMPurify.addHook !== 'function') return
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A' && node.getAttribute('href')) {
      node.setAttribute('target', '_blank')
      node.setAttribute('rel', 'noopener noreferrer')
    }
    neutralizeRemote(node)
  })
  hooked = true
}

/** Strip/flag any remote-loading attributes on a node (respecting allowRemote). */
function neutralizeRemote(node) {
  if (typeof node.getAttribute !== 'function') return

  for (const attr of ['src', 'poster', 'srcset', 'background']) {
    const v = node.getAttribute(attr)
    if (v && REMOTE_URL.test(v)) {
      sawRemote = true
      if (!activeAllowRemote) node.removeAttribute(attr)
    }
  }

  const style = node.getAttribute('style')
  if (style && REMOTE_IN_STYLE.test(style)) {
    sawRemote = true
    REMOTE_IN_STYLE.lastIndex = 0 // reset the global regex before reuse
    if (!activeAllowRemote) node.setAttribute('style', style.replace(REMOTE_IN_STYLE, 'none'))
  }
}

/**
 * Sanitise an HTML email body.
 *
 * @param {string} html
 * @param {{allowRemote?: boolean}} [opts]
 * @returns {{ html: string, hasRemote: boolean }} sanitised markup plus whether
 *   the source referenced any remote content (used to show the "Load remote
 *   images" affordance).
 */
export function sanitizeEmailBody(html, { allowRemote = false } = {}) {
  ensureHook()
  activeAllowRemote = allowRemote
  sawRemote = false
  try {
    const clean = DOMPurify.sanitize(html ?? '', EMAIL_HTML_CONFIG)
    return { html: clean, hasRemote: sawRemote }
  } finally {
    activeAllowRemote = false
  }
}

/** Sanitise an HTML email body, returning a safe HTML string (remote blocked). */
export function sanitizeEmailHtml(html, opts) {
  return sanitizeEmailBody(html, opts).html
}

/** Strip all markup, returning plain text only. */
export function stripHtml(html) {
  return DOMPurify.sanitize(html ?? '', { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })
}
