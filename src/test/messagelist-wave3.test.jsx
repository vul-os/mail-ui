/**
 * messagelist-wave3.test.jsx — infinite-scroll load-more footer + bulk snooze.
 */
import { render, screen, fireEvent, within } from '@testing-library/react'
import MessageList from '../components/MessageList.jsx'

function makeThread(i) {
  return {
    id: `t${i}`, from: `s${i}@x.com`, fromName: `Sender ${i}`,
    subject: `Subject ${i}`, preview: `Preview ${i}`,
    date: new Date(Date.now() - i * 1000).toISOString(),
    unread: false, starred: false, count: 1, hasAttachments: false,
    messages: [{ id: `t${i}`, flags: ['\\Seen'] }], latest: { id: `t${i}` },
  }
}
const makeThreads = (n) => Array.from({ length: n }, (_, i) => makeThread(i))
const noSel = new Set()

describe('MessageList — load more', () => {
  it('shows a Load more button when hasMore and fires onLoadMore', () => {
    const onLoadMore = vi.fn()
    render(<MessageList threads={makeThreads(3)} selection={noSel} hasMore onLoadMore={onLoadMore} />)
    const btn = screen.getByRole('button', { name: /load more/i })
    fireEvent.click(btn)
    expect(onLoadMore).toHaveBeenCalledOnce()
  })

  it('renders a loading status (not the button) while a page is in flight', () => {
    render(<MessageList threads={makeThreads(3)} selection={noSel} hasMore loadingMore onLoadMore={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument()
    expect(screen.getByText(/loading more/i)).toBeInTheDocument()
  })

  it('renders no load-more footer when hasMore is false', () => {
    render(<MessageList threads={makeThreads(3)} selection={noSel} hasMore={false} onLoadMore={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument()
  })
})

describe('MessageList — bulk snooze', () => {
  it('opens the snooze menu and fires onSnooze(null, date) for the selection', () => {
    const onSnooze = vi.fn()
    const threads = makeThreads(3)
    const sel = new Set([threads[0].id, threads[1].id])
    const snoozeItems = [{ id: 'tomorrow', label: 'Tomorrow', sub: 'Mon 8:00 AM', date: new Date('2026-07-02T08:00:00Z') }]
    render(
      <MessageList threads={threads} selection={sel} onDelete={vi.fn()}
        canSnooze snoozeItems={snoozeItems} onSnooze={onSnooze} />,
    )
    const toolbar = screen.getByRole('toolbar', { name: /bulk actions/i })
    fireEvent.click(within(toolbar).getByRole('button', { name: /snooze selected/i }))
    // Menu opens; pick the preset.
    fireEvent.click(screen.getByRole('menuitem', { name: /tomorrow/i }))
    expect(onSnooze).toHaveBeenCalledWith(null, snoozeItems[0].date)
  })

  it('hides the bulk snooze trigger when canSnooze is false', () => {
    const threads = makeThreads(2)
    const sel = new Set(threads.map((t) => t.id))
    render(<MessageList threads={threads} selection={sel} onDelete={vi.fn()} snoozeItems={[{ id: 'x', label: 'X', date: new Date() }]} />)
    expect(screen.queryByRole('button', { name: /snooze selected/i })).not.toBeInTheDocument()
  })
})
