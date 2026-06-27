import { describe, it, expect } from 'vitest'
import { sanitizeEmailBody, sanitizeEmailHtml, stripHtml } from '../components/sanitize.js'

describe('sanitizeEmailBody — XSS chokepoint', () => {
  it('drops scripts and inline event handlers', () => {
    const { html } = sanitizeEmailBody('<p onclick="evil()">hi</p><script>steal()</script>')
    expect(html).toContain('hi')
    expect(html).not.toContain('onclick')
    expect(html).not.toContain('<script')
  })

  it('hardens anchors with target/rel', () => {
    const { html } = sanitizeEmailBody('<a href="https://x.test">link</a>')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
  })
})

describe('sanitizeEmailBody — remote content blocking', () => {
  it('strips remote <img> src by default and flags hasRemote', () => {
    const { html, hasRemote } = sanitizeEmailBody('<img src="https://tracker.test/pixel.gif" alt="x">')
    expect(hasRemote).toBe(true)
    expect(html).not.toContain('tracker.test')
    expect(html).toContain('alt="x"')
  })

  it('strips protocol-relative remote images too', () => {
    const { html, hasRemote } = sanitizeEmailBody('<img src="//cdn.test/a.png">')
    expect(hasRemote).toBe(true)
    expect(html).not.toContain('cdn.test')
  })

  it('keeps inline data: images and reports no remote content', () => {
    const data = 'data:image/png;base64,iVBORw0KGgo='
    const { html, hasRemote } = sanitizeEmailBody(`<img src="${data}">`)
    expect(hasRemote).toBe(false)
    expect(html).toContain(data)
  })

  it('preserves remote images when allowRemote is true', () => {
    const { html, hasRemote } = sanitizeEmailBody('<img src="https://cdn.test/a.png">', { allowRemote: true })
    expect(hasRemote).toBe(true)
    expect(html).toContain('cdn.test')
  })

  it('neutralises remote background images in inline style', () => {
    const { html, hasRemote } = sanitizeEmailBody('<div style="background:url(https://t.test/p.png)">x</div>')
    expect(hasRemote).toBe(true)
    expect(html).not.toContain('t.test')
  })
})

describe('sanitizeEmailHtml / stripHtml string helpers', () => {
  it('sanitizeEmailHtml returns a string and blocks remote by default', () => {
    const out = sanitizeEmailHtml('<img src="https://t.test/x.png">hi')
    expect(typeof out).toBe('string')
    expect(out).not.toContain('t.test')
    expect(out).toContain('hi')
  })

  it('stripHtml removes all markup', () => {
    expect(stripHtml('<b>bold</b> text')).toBe('bold text')
  })
})
