import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import MailApp from '../components/MailApp.jsx'

// Two unrelated conversations (distinct subjects, no threading headers) so each
// is its own thread in the list.
function makeClient() {
  let msgs = [
    { id: 'm1', from: 'a@x.com', fromName: 'Alice', subject: 'First', preview: 'one', html: '<p>one</p>', date: new Date().toISOString(), flags: ['\\Seen'], messageId: '<m1>' },
    { id: 'm2', from: 'b@x.com', fromName: 'Bob', subject: 'Second', preview: 'two', html: '<p>two</p>', date: new Date(Date.now() - 1000).toISOString(), flags: ['\\Seen'], messageId: '<m2>' },
  ]
  return {
    me: vi.fn(async () => ({ email: 'me@x.com', username: 'me' })),
    listFolders: vi.fn(async () => [{ path: 'INBOX', name: 'INBOX', attributes: ['\\Inbox'] }]),
    listMessages: vi.fn(async () => msgs.map((m) => ({ ...m, flags: [...m.flags] }))),
    getMessage: vi.fn(async (uid) => ({ ...msgs.find((m) => m.id === uid), __full: true })),
    search: vi.fn(async () => []),
    setFlag: vi.fn(async () => null),
    deleteMessage: vi.fn(async (uid) => { msgs = msgs.filter((m) => m.id !== uid); return null }),
    moveMessage: vi.fn(async () => null),
    saveDraft: vi.fn(async () => ({ saved: true })),
    sendMessage: vi.fn(async () => ({ sent: true })),
    listContacts: vi.fn(async () => []),
  }
}

const readSubject = () => document.querySelector('.vm-read-subject')?.textContent

beforeEach(() => { localStorage.clear() })

describe('auto-advance triage', () => {
  it('opens the next conversation after deleting the open one', async () => {
    const client = makeClient()
    render(<MailApp client={client} />)
    await screen.findByText('First')

    // Open the first conversation → reading pane shows it.
    fireEvent.click(screen.getByText('First'))
    await waitFor(() => expect(readSubject()).toBe('First'))

    // Delete via keyboard (#): the reading pane advances to "Second".
    fireEvent.keyDown(document.body, { key: '#' })
    await waitFor(() => expect(readSubject()).toBe('Second'))
  })

  it('falls back to the list when autoAdvance is off', async () => {
    localStorage.setItem('vulos-mail.settings.v1', JSON.stringify({ autoAdvance: false }))
    const client = makeClient()
    render(<MailApp client={client} />)
    await screen.findByText('First')

    fireEvent.click(screen.getByText('First'))
    await waitFor(() => expect(readSubject()).toBe('First'))

    fireEvent.keyDown(document.body, { key: '#' })
    // Reading pane clears back to the placeholder instead of advancing.
    await waitFor(() => expect(screen.getByText('Select a conversation to read')).toBeInTheDocument())
    expect(readSubject()).toBeUndefined()
  })
})
