/**
 * folderlist-extended.test.jsx
 *
 * Additional FolderList tests covering:
 *   - classifyFolder utility (all special kinds + label fallback)
 *   - classifyCategory utility
 *   - Deep label nesting with correct indent padding
 *   - More group expand/collapse cycle
 *   - Active state on deeply nested current folder
 *   - Collapsed rail renders compose button + no folder names
 */
import { render, screen, fireEvent } from '@testing-library/react'
import FolderList, {
  classifyFolder,
  classifyCategory,
  STARRED_FOLDER,
} from '../components/FolderList.jsx'

// ---------------------------------------------------------------------------
// classifyFolder — pure utility
// ---------------------------------------------------------------------------
describe('classifyFolder', () => {
  it('classifies INBOX by name (any case)', () => {
    expect(classifyFolder({ name: 'INBOX', path: 'INBOX' })).toBe('inbox')
    expect(classifyFolder({ name: 'Inbox', path: 'Inbox' })).toBe('inbox')
  })

  it('classifies Sent by \\Sent attribute', () => {
    expect(classifyFolder({ name: 'Sent', attributes: ['\\Sent'] })).toBe('sent')
  })

  it('classifies Sent by name containing "sent"', () => {
    expect(classifyFolder({ name: 'Sent Messages' })).toBe('sent')
  })

  it('classifies Drafts by name containing "draft"', () => {
    expect(classifyFolder({ name: 'Drafts' })).toBe('drafts')
    expect(classifyFolder({ name: 'Draft' })).toBe('drafts')
  })

  it('classifies Trash by name', () => {
    expect(classifyFolder({ name: 'Trash' })).toBe('trash')
  })

  it('classifies "Deleted Items" as trash', () => {
    expect(classifyFolder({ name: 'Deleted Items' })).toBe('trash')
  })

  it('classifies "Bin" as trash', () => {
    expect(classifyFolder({ name: 'Bin' })).toBe('trash')
  })

  it('classifies Archive by name', () => {
    expect(classifyFolder({ name: 'Archive' })).toBe('archive')
    expect(classifyFolder({ name: 'Archived' })).toBe('archive')
  })

  it('classifies Spam and Junk', () => {
    expect(classifyFolder({ name: 'Spam' })).toBe('junk')
    expect(classifyFolder({ name: 'Junk' })).toBe('junk')
  })

  it('classifies \\Junk attribute as junk', () => {
    expect(classifyFolder({ name: 'Bulk', attributes: ['\\Junk'] })).toBe('junk')
  })

  it('classifies unknown folders as label', () => {
    expect(classifyFolder({ name: 'Work' })).toBe('label')
    expect(classifyFolder({ name: 'Personal' })).toBe('label')
    expect(classifyFolder({ name: 'Receipts' })).toBe('label')
  })

  it('classifies deeply nested unknown path as label', () => {
    expect(classifyFolder({ name: 'ACME', path: 'Work/Clients/ACME' })).toBe('label')
  })
})

// ---------------------------------------------------------------------------
// classifyCategory — pure utility
// ---------------------------------------------------------------------------
describe('classifyCategory', () => {
  it('returns "social" for a Social folder', () => {
    expect(classifyCategory({ name: 'Social', path: 'Social' })).toBe('social')
  })

  it('returns "promotions" for a Promotions folder', () => {
    expect(classifyCategory({ name: 'Promotions', path: 'Promotions' })).toBe('promotions')
    expect(classifyCategory({ name: 'Promos', path: 'Promos' })).toBe('promotions')
  })

  it('returns "updates" for an Updates folder', () => {
    expect(classifyCategory({ name: 'Updates', path: 'Updates' })).toBe('updates')
  })

  it('returns "forums" for a Forums folder', () => {
    expect(classifyCategory({ name: 'Forums', path: 'Forums' })).toBe('forums')
  })

  it('returns null for non-category label folders', () => {
    expect(classifyCategory({ name: 'Work', path: 'Work' })).toBeNull()
    expect(classifyCategory({ name: 'Receipts', path: 'Receipts' })).toBeNull()
    expect(classifyCategory({ name: 'ACME', path: 'Work/Clients/ACME' })).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// STARRED_FOLDER constant
// ---------------------------------------------------------------------------
describe('STARRED_FOLDER', () => {
  it('exports the __starred sentinel', () => {
    expect(STARRED_FOLDER).toBe('__starred')
  })

  it('renders a Starred virtual folder button', () => {
    render(
      <FolderList
        folders={[{ name: 'INBOX', path: 'INBOX', unread: 0 }]}
        current="INBOX"
        onSelect={vi.fn()}
      />,
    )
    expect(screen.getByTitle('Starred')).toBeInTheDocument()
  })

  it('marks __starred as active when it is the current folder', () => {
    render(
      <FolderList
        folders={[{ name: 'INBOX', path: 'INBOX' }]}
        current={STARRED_FOLDER}
        onSelect={vi.fn()}
      />,
    )
    expect(screen.getByTitle('Starred')).toHaveClass('vm-active')
  })
})

// ---------------------------------------------------------------------------
// More group expand / collapse
// ---------------------------------------------------------------------------
const FULL_FOLDERS = [
  { name: 'INBOX', path: 'INBOX', unread: 4 },
  { name: 'Sent', path: 'Sent', attributes: ['\\Sent'] },
  { name: 'Drafts', path: 'Drafts' },
  { name: 'Trash', path: 'Trash' },
  { name: 'Spam', path: 'Spam' },
  { name: 'Archive', path: 'Archive' },
]

describe('FolderList — More group expand / collapse', () => {
  it('hides Trash / Spam / Archive behind the More disclosure by default', () => {
    render(<FolderList folders={FULL_FOLDERS} current="INBOX" onSelect={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /^trash$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^spam$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^archive$/i })).not.toBeInTheDocument()
  })

  it('reveals More folders on click', () => {
    render(<FolderList folders={FULL_FOLDERS} current="INBOX" onSelect={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /^more$/i }))
    expect(screen.getByRole('button', { name: /^trash$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^spam$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^archive$/i })).toBeInTheDocument()
  })

  it('changes the toggle label to "Less" when expanded', () => {
    render(<FolderList folders={FULL_FOLDERS} current="INBOX" onSelect={vi.fn()} />)
    const btn = screen.getByRole('button', { name: /^more$/i })
    fireEvent.click(btn)
    expect(screen.getByRole('button', { name: /^less$/i })).toBeInTheDocument()
  })

  it('collapses the group again when Less is clicked', () => {
    render(<FolderList folders={FULL_FOLDERS} current="INBOX" onSelect={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /^more$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^less$/i }))
    expect(screen.queryByRole('button', { name: /^trash$/i })).not.toBeInTheDocument()
  })

  it('toggles aria-expanded correctly on the More button', () => {
    render(<FolderList folders={FULL_FOLDERS} current="INBOX" onSelect={vi.fn()} />)
    const btn = screen.getByRole('button', { name: /^more$/i })
    expect(btn).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(btn)
    expect(screen.getByRole('button', { name: /^less$/i })).toHaveAttribute('aria-expanded', 'true')
  })
})

// ---------------------------------------------------------------------------
// Deep label nesting
// ---------------------------------------------------------------------------
describe('FolderList — deep label nesting', () => {
  const nestedFolders = [
    { name: 'INBOX', path: 'INBOX', unread: 0 },
    { name: 'Work', path: 'Work' },
    { name: 'Clients', path: 'Work/Clients' },
    { name: 'ACME', path: 'Work/Clients/ACME' },
  ]

  it('renders all nested label folders', () => {
    render(<FolderList folders={nestedFolders} current="INBOX" onSelect={vi.fn()} />)
    expect(screen.getByTitle('Work')).toBeInTheDocument()
    expect(screen.getByTitle('Clients')).toBeInTheDocument()
    expect(screen.getByTitle('ACME')).toBeInTheDocument()
  })

  it('applies increasing paddingLeft for deeper nesting levels', () => {
    render(<FolderList folders={nestedFolders} current="INBOX" onSelect={vi.fn()} />)

    const workBtn = screen.getByTitle('Work')
    const clientsBtn = screen.getByTitle('Clients')
    const acmeBtn = screen.getByTitle('ACME')

    // depth 0 (Work): no explicit inline padding
    // depth 1 (Work/Clients): some padding
    // depth 2 (Work/Clients/ACME): more padding
    const workPx = parseInt(workBtn.style.paddingLeft || '0')
    const clientsPx = parseInt(clientsBtn.style.paddingLeft || '0')
    const acmePx = parseInt(acmeBtn.style.paddingLeft || '0')

    expect(clientsPx).toBeGreaterThan(workPx)
    expect(acmePx).toBeGreaterThan(clientsPx)
  })

  it('fires onSelect with the full nested path', () => {
    const onSelect = vi.fn()
    render(<FolderList folders={nestedFolders} current="INBOX" onSelect={onSelect} />)
    fireEvent.click(screen.getByTitle('ACME'))
    expect(onSelect).toHaveBeenCalledWith('Work/Clients/ACME')
  })

  it('marks the deeply nested current folder as active', () => {
    render(
      <FolderList folders={nestedFolders} current="Work/Clients/ACME" onSelect={vi.fn()} />,
    )
    const acmeBtn = screen.getByTitle('ACME')
    expect(acmeBtn).toHaveClass('vm-active')
    expect(acmeBtn).toHaveAttribute('aria-current', 'true')
  })

  it('does not mark sibling nested folders as active', () => {
    render(
      <FolderList folders={nestedFolders} current="Work/Clients/ACME" onSelect={vi.fn()} />,
    )
    expect(screen.getByTitle('Work')).not.toHaveClass('vm-active')
    expect(screen.getByTitle('Clients')).not.toHaveClass('vm-active')
  })
})

// ---------------------------------------------------------------------------
// Collapsed rail
// ---------------------------------------------------------------------------
describe('FolderList — collapsed rail', () => {
  it('adds vm-collapsed class to nav when collapsed=true', () => {
    render(
      <FolderList
        folders={FULL_FOLDERS}
        current="INBOX"
        onSelect={vi.fn()}
        collapsed={true}
      />,
    )
    expect(screen.getByRole('navigation', { name: /mailboxes/i })).toHaveClass('vm-collapsed')
  })

  it('does not add vm-collapsed when collapsed=false', () => {
    render(
      <FolderList
        folders={FULL_FOLDERS}
        current="INBOX"
        onSelect={vi.fn()}
        collapsed={false}
      />,
    )
    expect(screen.getByRole('navigation', { name: /mailboxes/i })).not.toHaveClass('vm-collapsed')
  })

  it('calls onToggleCollapse when rail toggle button is clicked', () => {
    const onToggleCollapse = vi.fn()
    render(
      <FolderList
        folders={FULL_FOLDERS}
        current="INBOX"
        onSelect={vi.fn()}
        onToggleCollapse={onToggleCollapse}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /collapse menu/i }))
    expect(onToggleCollapse).toHaveBeenCalledOnce()
  })
})
