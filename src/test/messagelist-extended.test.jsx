/**
 * messagelist-extended.test.jsx
 *
 * Additional MessageList tests covering:
 *   - Large dataset rendering (100 threads)
 *   - Error state + Retry
 *   - Loading skeleton state
 *   - Search: clear button, folder-specific empty text
 *   - Bulk action toolbar completeness
 *   - Read-toggle quick action
 */
import { render, screen, fireEvent, within } from '@testing-library/react'
import MessageList from '../components/MessageList.jsx'

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------
function makeThread(i) {
  return {
    id: `t${i}`,
    from: `sender${i}@example.com`,
    fromName: `Sender ${i}`,
    subject: `Thread subject ${i}`,
    preview: `Preview text for message ${i}`,
    date: new Date(Date.now() - i * 60_000).toISOString(),
    unread: i % 3 === 0,    // every 3rd thread is unread
    starred: i % 7 === 0,   // every 7th is starred
    count: 1,
    hasAttachments: false,
  }
}

const makeThreads = (n) => Array.from({ length: n }, (_, i) => makeThread(i))
const noSel = new Set()

// ---------------------------------------------------------------------------
// Large datasets
// ---------------------------------------------------------------------------
describe('MessageList — large datasets', () => {
  it('renders all 100 threads without error', () => {
    const threads = makeThreads(100)
    render(<MessageList threads={threads} selection={noSel} />)
    // The list container must exist
    expect(screen.getByRole('list')).toBeInTheDocument()
    // First and last threads visible in the DOM (no virtualization dropping them)
    expect(screen.getByText('Thread subject 0')).toBeInTheDocument()
    expect(screen.getByText('Thread subject 99')).toBeInTheDocument()
  })

  it('applies vm-unread class to the correct rows in 30 threads', () => {
    render(<MessageList threads={makeThreads(30)} selection={noSel} />)
    const unread = document.querySelectorAll('.vm-unread')
    // indices 0, 3, 6, … 27 → 10 of 30
    expect(unread.length).toBe(10)
  })

  it('shows correct selection count in the bulk bar when 50 are selected', () => {
    const threads = makeThreads(50)
    const sel = new Set(threads.map((t) => t.id))
    render(<MessageList threads={threads} selection={sel} />)
    expect(screen.getByText('50 selected')).toBeInTheDocument()
  })

  it('renders all 200 thread rows without crashing', () => {
    const threads = makeThreads(200)
    render(<MessageList threads={threads} selection={noSel} />)
    expect(document.querySelectorAll('.vm-row').length).toBe(200)
  })
})

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------
describe('MessageList — error state', () => {
  it('renders the error message inside a role=alert element', () => {
    render(
      <MessageList threads={[]} selection={noSel} error="Connection refused" onRetry={vi.fn()} />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Connection refused')
  })

  it('calls onRetry when the Retry button is clicked', () => {
    const onRetry = vi.fn()
    render(
      <MessageList threads={[]} selection={noSel} error="Offline" onRetry={onRetry} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('does not render any thread rows when in error state', () => {
    render(
      <MessageList threads={makeThreads(5)} selection={noSel} error="Server error" onRetry={vi.fn()} />,
    )
    // Error state wins; no rows rendered even though threads prop is non-empty
    expect(document.querySelectorAll('.vm-row').length).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------
describe('MessageList — loading skeleton', () => {
  it('renders skeleton placeholders while loading', () => {
    render(<MessageList threads={[]} selection={noSel} loading />)
    const skeletons = document.querySelectorAll('.vm-skeleton')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('does not render any real rows while loading', () => {
    render(<MessageList threads={makeThreads(3)} selection={noSel} loading />)
    expect(document.querySelectorAll('.vm-row').length).toBe(0)
  })

  it('skeletons are aria-hidden so screen readers skip them', () => {
    render(<MessageList threads={[]} selection={noSel} loading />)
    for (const sk of document.querySelectorAll('.vm-skeleton')) {
      expect(sk).toHaveAttribute('aria-hidden', 'true')
    }
  })
})

// ---------------------------------------------------------------------------
// Search clear button & empty states
// ---------------------------------------------------------------------------
describe('MessageList — search interaction', () => {
  it('shows clear button when text is typed and clicking it empties the input', () => {
    const onClearSearch = vi.fn()
    render(<MessageList threads={[]} selection={noSel} onClearSearch={onClearSearch} />)
    const input = screen.getByRole('searchbox', { name: /search mail/i })

    // No clear button initially
    expect(screen.queryByRole('button', { name: /clear search/i })).not.toBeInTheDocument()

    fireEvent.change(input, { target: { value: 'invoice' } })

    const clearBtn = screen.getByRole('button', { name: /clear search/i })
    fireEvent.click(clearBtn)

    expect(input).toHaveValue('')
    expect(onClearSearch).toHaveBeenCalledOnce()
  })

  it('submits the trimmed query on form submit', () => {
    const onSearch = vi.fn()
    render(<MessageList threads={[]} selection={noSel} onSearch={onSearch} />)
    const input = screen.getByRole('searchbox', { name: /search mail/i })
    fireEvent.change(input, { target: { value: '  hello  ' } })
    fireEvent.submit(input.closest('form'))
    expect(onSearch).toHaveBeenCalledWith('hello')
  })
})

describe('MessageList — folder-specific empty text', () => {
  it('shows inbox-zero text for INBOX', () => {
    render(<MessageList threads={[]} selection={noSel} folder="INBOX" />)
    expect(screen.getByText(/inbox zero/i)).toBeInTheDocument()
  })

  it('shows Trash-is-empty text for Trash folder', () => {
    render(<MessageList threads={[]} selection={noSel} folder="Trash" />)
    expect(screen.getByText(/trash is empty/i)).toBeInTheDocument()
  })

  it('shows Nothing-archived text for Archive folder', () => {
    render(<MessageList threads={[]} selection={noSel} folder="Archive" />)
    expect(screen.getByText(/nothing archived/i)).toBeInTheDocument()
  })

  it('shows No-drafts text for Drafts folder', () => {
    render(<MessageList threads={[]} selection={noSel} folder="Drafts" />)
    expect(screen.getByText(/no drafts/i)).toBeInTheDocument()
  })

  it('shows No-results for a non-empty query with empty threads', () => {
    render(<MessageList threads={[]} selection={noSel} query="invoices" />)
    expect(screen.getByText('No results')).toBeInTheDocument()
    // No Compose CTA when in search mode
    expect(screen.queryByRole('button', { name: /compose/i })).not.toBeInTheDocument()
  })

  it('shows No-starred text for the __starred virtual folder', () => {
    render(<MessageList threads={[]} selection={noSel} folder="__starred" />)
    expect(screen.getByText(/no starred conversations/i)).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Bulk action toolbar
// ---------------------------------------------------------------------------
describe('MessageList — bulk action toolbar', () => {
  it('shows mark-read and mark-unread bulk actions', () => {
    const threads = makeThreads(3)
    const sel = new Set([threads[0].id])
    render(
      <MessageList
        threads={threads}
        selection={sel}
        onToggleRead={vi.fn()}
        onDelete={vi.fn()}
      />,
    )
    // Scope to the bulk actions toolbar to avoid colliding with per-row quick-actions
    const toolbar = screen.getByRole('toolbar', { name: /bulk actions/i })
    expect(within(toolbar).getByRole('button', { name: /mark read/i })).toBeInTheDocument()
    expect(within(toolbar).getByRole('button', { name: /mark unread/i })).toBeInTheDocument()
  })

  it('calls onToggleRead(null, true) for bulk mark-read', () => {
    const onToggleRead = vi.fn()
    const threads = makeThreads(2)
    const sel = new Set(threads.map((t) => t.id))
    render(
      <MessageList threads={threads} selection={sel} onToggleRead={onToggleRead} onDelete={vi.fn()} />,
    )
    // Scope to bulk toolbar to avoid ambiguity with per-row quick-action buttons
    const toolbar = screen.getByRole('toolbar', { name: /bulk actions/i })
    fireEvent.click(within(toolbar).getByRole('button', { name: /mark read/i }))
    expect(onToggleRead).toHaveBeenCalledWith(null, true)
  })

  it('calls onToggleStar(null, true) for bulk star', () => {
    const onToggleStar = vi.fn()
    const threads = makeThreads(2)
    const sel = new Set(threads.map((t) => t.id))
    render(
      <MessageList threads={threads} selection={sel} onToggleStar={onToggleStar} onDelete={vi.fn()} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /star selected/i }))
    expect(onToggleStar).toHaveBeenCalledWith(null, true)
  })

  it('hides Archive button when canArchive is false', () => {
    const threads = makeThreads(2)
    const sel = new Set(threads.map((t) => t.id))
    render(
      <MessageList threads={threads} selection={sel} canArchive={false} onDelete={vi.fn()} />,
    )
    expect(screen.queryByRole('button', { name: /archive selected/i })).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Row quick-actions (read-toggle)
// ---------------------------------------------------------------------------
describe('MessageList — read-toggle quick action', () => {
  it('shows "Mark read" quick-action for an unread thread', () => {
    const thread = { ...makeThread(0), unread: true }
    render(
      <MessageList threads={[thread]} selection={noSel} onToggleRead={vi.fn()} />,
    )
    expect(screen.getByRole('button', { name: /mark read/i })).toBeInTheDocument()
  })

  it('shows "Mark unread" quick-action for a read thread', () => {
    const thread = { ...makeThread(0), unread: false }
    render(
      <MessageList threads={[thread]} selection={noSel} onToggleRead={vi.fn()} />,
    )
    expect(screen.getByRole('button', { name: /mark unread/i })).toBeInTheDocument()
  })

  it('fires onToggleRead with the thread and its unread state', () => {
    const onToggleRead = vi.fn()
    const thread = { ...makeThread(0), unread: true }
    render(<MessageList threads={[thread]} selection={noSel} onToggleRead={onToggleRead} />)
    // Quick-action in the row actions area
    fireEvent.click(screen.getByRole('button', { name: /mark read/i }))
    expect(onToggleRead).toHaveBeenCalledWith(thread, true)
  })
})
