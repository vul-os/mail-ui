/**
 * reply.test.js
 *
 * Tests for reply.js:
 *   - replyAllCc: self-exclusion, sender exclusion, deduplication, case-insensitive
 *   - quoteReply: produces blockquote, escapes attribution
 *   - quoteForward: forwarded-message header + body
 */
import { replyAllCc, quoteReply, quoteForward } from '../components/reply.js'

// ---------------------------------------------------------------------------
// replyAllCc — reply-all self-exclusion
// ---------------------------------------------------------------------------
describe('replyAllCc — self-exclusion and deduplication', () => {
  const msg = {
    from: 'alice@example.com',
    fromName: 'Alice',
    to: 'bob@example.com, carol@example.com',
    cc: 'dave@example.com',
  }

  it('excludes my own address from the CC list', () => {
    const cc = replyAllCc(msg, 'bob@example.com')
    expect(cc).not.toContain('bob@example.com')
  })

  it('excludes the original sender from the CC list', () => {
    const cc = replyAllCc(msg, 'bob@example.com')
    expect(cc).not.toContain('alice@example.com')
  })

  it('includes all other To and Cc recipients', () => {
    const cc = replyAllCc(msg, 'bob@example.com')
    expect(cc).toContain('carol@example.com')
    expect(cc).toContain('dave@example.com')
  })

  it('performs case-insensitive self-exclusion', () => {
    const cc = replyAllCc(msg, 'BOB@EXAMPLE.COM')
    expect(cc).not.toContain('bob@example.com')
  })

  it('deduplicates addresses that appear in both To and Cc', () => {
    const dupeMsg = { ...msg, cc: 'carol@example.com, extra@example.com' }
    const cc = replyAllCc(dupeMsg, 'bob@example.com')
    const parts = cc.split(',').map((s) => s.trim()).filter(Boolean)
    const carolAppearances = parts.filter((p) => p === 'carol@example.com').length
    expect(carolAppearances).toBe(1)
  })

  it('returns empty string when there is no one else to CC', () => {
    const minimal = { from: 'alice@example.com', to: 'bob@example.com', cc: '' }
    // bob is replying to alice; only alice is in To, no CC — result should be empty
    const cc = replyAllCc(minimal, 'bob@example.com')
    expect(cc).toBe('')
  })

  it('handles completely empty To and Cc gracefully', () => {
    const empty = { from: 'alice@example.com', to: '', cc: '' }
    const cc = replyAllCc(empty, 'bob@example.com')
    expect(cc).toBe('')
  })

  it('handles multiple recipients in Cc correctly', () => {
    const multi = {
      from: 'alice@example.com',
      to: 'bob@example.com',
      cc: 'carol@example.com; dave@example.com; eve@example.com',
    }
    // Frank replies-all: alice (sender) and frank (self) excluded;
    // bob (To), carol, dave, eve all included.
    const cc = replyAllCc(multi, 'frank@example.com')
    expect(cc).toContain('bob@example.com')
    expect(cc).toContain('carol@example.com')
    expect(cc).toContain('dave@example.com')
    expect(cc).toContain('eve@example.com')
    expect(cc).not.toContain('alice@example.com')
    expect(cc).not.toContain('frank@example.com')
  })

  it('handles absent myEmail (empty string) — excludes empty from list', () => {
    const cc = replyAllCc(msg, '')
    // sender (alice) excluded; mine is '' which matches nothing meaningful
    expect(cc).not.toContain('alice@example.com')
    expect(cc).toContain('carol@example.com')
  })
})

// ---------------------------------------------------------------------------
// quoteReply — blockquote generation
// ---------------------------------------------------------------------------
describe('quoteReply', () => {
  it('produces a <blockquote> wrapping the original body', () => {
    const m = {
      from: 'alice@example.com',
      fromName: 'Alice',
      date: '2024-01-15T10:00:00Z',
      html: '<p>Original message</p>',
    }
    const result = quoteReply(m)
    expect(result).toContain('<blockquote')
    expect(result).toContain('Original message')
  })

  it('includes the fromName in the attribution line', () => {
    const m = {
      from: 'alice@example.com',
      fromName: 'Alice Smith',
      date: '2024-01-15T10:00:00Z',
      body: 'text',
    }
    const result = quoteReply(m)
    expect(result).toContain('Alice Smith')
  })

  it('escapes HTML special characters in fromName to prevent XSS', () => {
    const m = {
      from: 'evil@example.com',
      fromName: '<script>alert(1)</script>',
      date: '2024-01-15T10:00:00Z',
      body: 'Hello',
    }
    const result = quoteReply(m)
    expect(result).not.toContain('<script>')
    expect(result).toContain('&lt;script&gt;')
  })

  it('falls back to plain text body when html is absent', () => {
    const m = {
      from: 'alice@example.com',
      date: '2024-01-15T10:00:00Z',
      body: 'Plain text reply',
    }
    const result = quoteReply(m)
    expect(result).toContain('Plain text reply')
  })

  it('uses preview as fallback when both html and body are absent', () => {
    const m = {
      from: 'alice@example.com',
      date: '2024-01-15T10:00:00Z',
      preview: 'Snippet from email',
    }
    const result = quoteReply(m)
    expect(result).toContain('Snippet from email')
  })
})

// ---------------------------------------------------------------------------
// quoteForward — forwarded message block
// ---------------------------------------------------------------------------
describe('quoteForward', () => {
  const m = {
    from: 'alice@example.com',
    fromName: 'Alice',
    date: '2024-01-15T10:00:00Z',
    subject: 'Original subject',
    to: 'bob@example.com',
    body: 'Original body text',
  }

  it('includes the "Forwarded message" banner', () => {
    expect(quoteForward(m)).toContain('Forwarded message')
  })

  it('includes the sender address', () => {
    expect(quoteForward(m)).toContain('alice@example.com')
  })

  it('includes the original subject', () => {
    expect(quoteForward(m)).toContain('Original subject')
  })

  it('includes the original body', () => {
    expect(quoteForward(m)).toContain('Original body text')
  })

  it('omits the To line when m.to is absent', () => {
    const noTo = { ...m, to: '' }
    const result = quoteForward(noTo)
    // The "To:" line should not appear when there's no recipient
    expect(result).not.toMatch(/\bTo:\s*\n/)
  })

  it('escapes HTML in subject and addresses', () => {
    const evil = { ...m, subject: '<script>pwn()</script>' }
    const result = quoteForward(evil)
    expect(result).not.toContain('<script>')
  })
})
