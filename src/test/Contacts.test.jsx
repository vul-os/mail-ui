import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Contacts from '../components/Contacts.jsx'

// Lean-only client (older server): no cards endpoint → read-only, feeds onSelect.
function leanClient(rows) {
  return { listContacts: vi.fn(async () => rows) }
}

// Full CRUD client (wave2 server): cards + create/update/delete.
function cardsClient(cards) {
  return {
    listContactCards: vi.fn(async () => cards),
    listContacts: vi.fn(async () => cards.map((c) => ({ email: c.emails?.[0], name: c.name }))),
    createContact: vi.fn(async (c) => ({ ...c, uid: 'new' })),
    updateContact: vi.fn(async (uid, c) => ({ ...c, uid })),
    deleteContact: vi.fn(async () => null),
  }
}

describe('<Contacts/>', () => {
  beforeEach(() => { window.confirm = vi.fn(() => true) })

  it('renders contacts from the client', async () => {
    const client = leanClient([
      { email: 'alice@x.com', name: 'Alice' },
      { email: 'bob@x.com', name: 'Bob' },
    ])
    render(<Contacts client={client} />)
    expect(await screen.findByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(client.listContacts).toHaveBeenCalled()
  })

  it('fires onSelect when a contact is clicked', async () => {
    const onSelect = vi.fn()
    const client = leanClient([{ email: 'alice@x.com', name: 'Alice' }])
    render(<Contacts client={client} onSelect={onSelect} />)
    fireEvent.click(await screen.findByText('Alice'))
    expect(onSelect).toHaveBeenCalledWith({ email: 'alice@x.com', name: 'Alice' })
  })

  it('shows empty state when there are no contacts', async () => {
    const client = leanClient([])
    render(<Contacts client={client} />)
    await waitFor(() => expect(screen.getByText('No contacts')).toBeInTheDocument())
  })

  it('hides the New button on a lean-only (read-only) server', async () => {
    const client = leanClient([{ email: 'a@x.com', name: 'A' }])
    render(<Contacts client={client} />)
    await screen.findByText('a@x.com')
    expect(screen.queryByRole('button', { name: /new/i })).not.toBeInTheDocument()
  })

  it('uses the cards endpoint and creates a contact', async () => {
    const client = cardsClient([{ uid: 'c1', name: 'Alice', emails: ['alice@x.com'] }])
    render(<Contacts client={client} />)
    await screen.findByText('Alice')
    expect(client.listContactCards).toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /new/i }))
    await screen.findByRole('dialog', { name: /new contact/i })
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Charlie' } })
    fireEvent.change(screen.getByLabelText('Email 1'), { target: { value: 'charlie@x.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(client.createContact).toHaveBeenCalled())
    expect(client.createContact.mock.calls[0][0]).toMatchObject({ name: 'Charlie', emails: ['charlie@x.com'] })
  })

  it('edits a contact via the edit affordance', async () => {
    const client = cardsClient([{ uid: 'c1', name: 'Alice', emails: ['alice@x.com'], path: '/ab/c1.vcf' }])
    render(<Contacts client={client} />)
    await screen.findByText('Alice')
    fireEvent.click(screen.getByRole('button', { name: /edit alice/i }))
    await screen.findByRole('dialog', { name: /edit contact/i })
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Alice M' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(client.updateContact).toHaveBeenCalled())
    const [uid, c] = client.updateContact.mock.calls[0]
    expect(uid).toBe('c1')
    expect(c).toMatchObject({ name: 'Alice M', path: '/ab/c1.vcf' })
  })

  it('deletes a contact from the editor', async () => {
    const client = cardsClient([{ uid: 'c1', name: 'Alice', emails: ['alice@x.com'] }])
    render(<Contacts client={client} />)
    await screen.findByText('Alice')
    fireEvent.click(screen.getByRole('button', { name: /edit alice/i }))
    await screen.findByRole('dialog', { name: /edit contact/i })
    fireEvent.click(screen.getByRole('button', { name: /delete/i }))
    await waitFor(() => expect(client.deleteContact).toHaveBeenCalled())
    expect(client.deleteContact.mock.calls[0][0]).toBe('c1')
  })

  it('falls back to lean search when the cards endpoint 404s', async () => {
    const err = Object.assign(new Error('nope'), { status: 404 })
    const client = {
      listContactCards: vi.fn(async () => { throw err }),
      listContacts: vi.fn(async () => [{ email: 'a@x.com', name: 'A' }]),
    }
    render(<Contacts client={client} />)
    expect(await screen.findByText('a@x.com')).toBeInTheDocument()
    expect(client.listContacts).toHaveBeenCalled()
    // Editing disabled after the fallback.
    expect(screen.queryByRole('button', { name: /new/i })).not.toBeInTheDocument()
  })
})
