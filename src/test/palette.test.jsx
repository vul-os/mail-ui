import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import CommandPalette, { fuzzyScore } from '../components/CommandPalette.jsx'

afterEach(cleanup)

describe('fuzzyScore', () => {
  it('matches subsequences and ranks contiguous / boundary hits higher', () => {
    expect(fuzzyScore('Archive', 'arch')).toBeGreaterThan(0)
    expect(fuzzyScore('Archive', 'xyz')).toBe(0)
    // "inbox" should beat a buried match for the query "inb".
    expect(fuzzyScore('Inbox', 'inb')).toBeGreaterThan(fuzzyScore('Pin board', 'inb'))
  })

  it('treats an empty query as a neutral match (whole list shows)', () => {
    expect(fuzzyScore('anything', '')).toBeGreaterThan(0)
  })
})

const CMDS = [
  { id: 'go-inbox', section: 'Go to', title: 'Inbox', run: vi.fn() },
  { id: 'go-sent', section: 'Go to', title: 'Sent', run: vi.fn() },
  { id: 'a-archive', section: 'Actions', title: 'Archive', run: vi.fn() },
  { id: 'a-compose', section: 'Actions', title: 'Compose new message', keywords: 'write', run: vi.fn() },
]

describe('<CommandPalette/>', () => {
  it('filters commands as you type', () => {
    render(<CommandPalette commands={CMDS} onClose={() => {}} />)
    expect(screen.getByText('Inbox')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Command'), { target: { value: 'arch' } })
    expect(screen.getByText('Archive')).toBeInTheDocument()
    expect(screen.queryByText('Inbox')).not.toBeInTheDocument()
  })

  it('matches on keywords, not just the visible title', () => {
    render(<CommandPalette commands={CMDS} onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText('Command'), { target: { value: 'write' } })
    expect(screen.getByText('Compose new message')).toBeInTheDocument()
  })

  it('runs the highlighted command on Enter and closes', () => {
    const onClose = vi.fn()
    render(<CommandPalette commands={CMDS} onClose={onClose} />)
    const input = screen.getByLabelText('Command')
    fireEvent.change(input, { target: { value: 'archive' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(CMDS[2].run).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalled()
  })

  it('walks the list with ArrowDown and runs the right entry', () => {
    render(<CommandPalette commands={CMDS} onClose={() => {}} />)
    const input = screen.getByLabelText('Command')
    fireEvent.keyDown(input, { key: 'ArrowDown' }) // → Sent (index 1)
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(CMDS[1].run).toHaveBeenCalled()
  })

  it('Escape closes without running anything', () => {
    const onClose = vi.fn()
    render(<CommandPalette commands={CMDS} onClose={onClose} />)
    fireEvent.keyDown(screen.getByLabelText('Command'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('shows an empty state when nothing matches', () => {
    render(<CommandPalette commands={CMDS} onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText('Command'), { target: { value: 'zzzzz' } })
    expect(screen.getByText('No matching commands')).toBeInTheDocument()
  })

  it('skips disabled commands', () => {
    render(<CommandPalette commands={[{ id: 'x', title: 'Nope', disabled: true, run: vi.fn() }]} onClose={() => {}} />)
    expect(screen.queryByText('Nope')).not.toBeInTheDocument()
  })
})
