import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import FolderList from '../components/FolderList.jsx'

describe('<FolderList/> mobile drawer extras', () => {
  it('surfaces Calendar / Contacts / Settings / Shortcuts when handlers are passed', () => {
    const onOpenPanel = vi.fn()
    const onOpenHelp = vi.fn()
    render(<FolderList folders={[]} onOpenPanel={onOpenPanel} onOpenHelp={onOpenHelp} />)

    fireEvent.click(screen.getByRole('button', { name: 'Calendar' }))
    expect(onOpenPanel).toHaveBeenCalledWith('calendar')
    fireEvent.click(screen.getByRole('button', { name: 'Contacts' }))
    expect(onOpenPanel).toHaveBeenCalledWith('contacts')
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(onOpenPanel).toHaveBeenCalledWith('settings')
    fireEvent.click(screen.getByRole('button', { name: 'Shortcuts' }))
    expect(onOpenHelp).toHaveBeenCalled()
  })

  it('omits the extras block when no handlers are provided', () => {
    render(<FolderList folders={[]} />)
    expect(screen.queryByRole('button', { name: 'Calendar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Shortcuts' })).not.toBeInTheDocument()
  })
})

const SPECIALS = [
  { path: 'INBOX', name: 'INBOX', attributes: ['\\Inbox'], unread: 4 },
  { path: 'Sent', name: 'Sent', attributes: ['\\Sent'] },
  { path: 'Drafts', name: 'Drafts', attributes: ['\\Drafts'], unread: 2 },
  { path: 'Archive', name: 'Archive', attributes: ['\\Archive'] },
  { path: 'Spam', name: 'Spam', attributes: ['\\Junk'] },
  { path: 'Trash', name: 'Trash', attributes: ['\\Trash'] },
]

describe('<FolderList/> comprehensive sidebar', () => {
  it('shows the primary mailboxes with an unread count', () => {
    render(<FolderList folders={SPECIALS} current="INBOX" />)
    expect(screen.getByRole('button', { name: /Inbox/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Starred/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Sent/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Drafts/ })).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument() // inbox unread
  })

  it('tucks the less-used mailboxes behind a "More" disclosure', () => {
    render(<FolderList folders={SPECIALS} current="INBOX" />)
    // Hidden until expanded.
    expect(screen.queryByRole('button', { name: /Trash/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'More' }))
    expect(screen.getByRole('button', { name: /Trash/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Spam/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Archive/ })).toBeInTheDocument()
  })

  it('renders Categories + Labels only when such folders exist', () => {
    const folders = [
      ...SPECIALS,
      { path: 'Social', name: 'Social' },
      { path: 'Work', name: 'Work', unread: 1 },
    ]
    render(<FolderList folders={folders} current="INBOX" onManageLabels={() => {}} />)
    expect(screen.getByText('Categories')).toBeInTheDocument()
    expect(screen.getByText('Labels')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Social/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Work/ })).toBeInTheDocument()
  })

  it('degrades: no Categories / Labels / storage when the backend offers none', () => {
    render(<FolderList folders={SPECIALS} current="INBOX" />)
    expect(screen.queryByText('Categories')).not.toBeInTheDocument()
    expect(screen.queryByText('Labels')).not.toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })

  it('shows a storage meter when quota is provided', () => {
    render(<FolderList folders={SPECIALS} current="INBOX" quota={{ used: 5e9, limit: 10e9 }} />)
    const bar = screen.getByRole('progressbar', { name: 'Storage used' })
    expect(bar).toHaveAttribute('aria-valuenow', '50')
  })
})
