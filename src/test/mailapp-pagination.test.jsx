/**
 * mailapp-pagination.test.jsx — infinite-scroll wiring at the app level.
 *
 * jsdom has no IntersectionObserver, so we drive the explicit "Load more"
 * fallback button (same handler the observer calls).
 */
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import MailApp from '../components/MailApp.jsx'

const mk = (id, subject) => ({
  id, from: `${id}@x.com`, fromName: id, subject, preview: `body of ${subject}`,
  date: new Date(Date.now() - Number(id.replace(/\D/g, '')) * 1000).toISOString(),
  flags: ['\\Seen'], messageId: `<${id}>`,
})

function paginatingClient() {
  const pages = [
    { messages: [mk('p1', 'One'), mk('p2', 'Two')], total: 4, nextOffset: 2, hasMore: true },
    { messages: [mk('p3', 'Three'), mk('p4', 'Four')], total: 4, nextOffset: 4, hasMore: false },
  ]
  return {
    me: vi.fn(async () => ({ email: 'me@x.com', username: 'me' })),
    listFolders: vi.fn(async () => [{ path: 'INBOX', name: 'INBOX', attributes: ['\\Inbox'] }]),
    listMessagesPage: vi.fn(async ({ offset = 0 }) => (offset >= 2 ? pages[1] : pages[0])),
    getMessage: vi.fn(async (uid) => mk(uid, uid)),
    setFlag: vi.fn(async () => null),
    listContacts: vi.fn(async () => []),
  }
}

beforeEach(() => { localStorage.clear() })

describe('MailApp — infinite scroll', () => {
  it('appends the next page when Load more is clicked', async () => {
    const client = paginatingClient()
    render(<MailApp client={client} />)
    await screen.findByText('One')

    // First page only.
    expect(screen.getByText('Two')).toBeInTheDocument()
    expect(screen.queryByText('Three')).not.toBeInTheDocument()

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /load more/i })) })

    await screen.findByText('Three')
    expect(screen.getByText('Four')).toBeInTheDocument()
    // Terminal page → the footer button is gone.
    await waitFor(() => expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument())
  })

  it('stops (no duplicates) when the server ignores paging params', async () => {
    const same = { messages: [mk('p1', 'One'), mk('p2', 'Two')], total: 99, hasMore: true }
    const client = {
      me: vi.fn(async () => ({ email: 'me@x.com', username: 'me' })),
      listFolders: vi.fn(async () => [{ path: 'INBOX', name: 'INBOX', attributes: ['\\Inbox'] }]),
      listMessagesPage: vi.fn(async () => same),   // always the same first page
      getMessage: vi.fn(async (uid) => mk(uid, uid)),
      setFlag: vi.fn(async () => null),
      listContacts: vi.fn(async () => []),
    }
    render(<MailApp client={client} />)
    await screen.findByText('One')

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /load more/i })) })

    // De-dupe kicks in: still exactly one row each, and load-more retires.
    expect(screen.getAllByText('One')).toHaveLength(1)
    await waitFor(() => expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument())
  })
})
