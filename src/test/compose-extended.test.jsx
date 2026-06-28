/**
 * compose-extended.test.jsx
 *
 * Additional Compose tests covering:
 *   - send success / failure / missing-recipient validation
 *   - draft auto-save debounce
 *   - initial prop prefill (reply scenario)
 *   - contact autocomplete: suggestions, click-to-insert, keyboard navigation
 */
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import Compose from '../components/Compose.jsx'

// ---------------------------------------------------------------------------
// send / draft
// ---------------------------------------------------------------------------
describe('Compose — send', () => {
  it('calls onSend with collected fields then calls onClose on success', async () => {
    const onSend = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()
    render(<Compose onSend={onSend} onClose={onClose} />)

    fireEvent.change(screen.getByRole('textbox', { name: /^To$/i }), {
      target: { value: 'bob@example.com' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: /subject/i }), {
      target: { value: 'Hello there' },
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^send$/i }))
    })

    expect(onSend).toHaveBeenCalledOnce()
    expect(onSend).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'bob@example.com', subject: 'Hello there' }),
    )
    expect(onClose).toHaveBeenCalled()
  })

  it('shows validation error and does not call onSend when recipient is missing', async () => {
    const onSend = vi.fn()
    render(<Compose onSend={onSend} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^send$/i }))
    })

    expect(onSend).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(/add at least one recipient/i)
  })

  it('displays the rejection message when onSend rejects', async () => {
    const onSend = vi.fn().mockRejectedValue(new Error('SMTP timeout'))
    render(<Compose onSend={onSend} />)

    fireEvent.change(screen.getByRole('textbox', { name: /^To$/i }), {
      target: { value: 'alice@example.com' },
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^send$/i }))
    })

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('SMTP timeout'),
    )
  })

  it('disables the Send button while the send is in flight', async () => {
    let resolve
    const onSend = vi.fn().mockReturnValue(new Promise((r) => { resolve = r }))
    render(<Compose onSend={onSend} />)

    fireEvent.change(screen.getByRole('textbox', { name: /^To$/i }), {
      target: { value: 'bob@example.com' },
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^send$/i }))
    })

    expect(screen.getByRole('button', { name: /sending…/i })).toBeDisabled()

    // settle promise
    await act(async () => { resolve() })
  })
})

// ---------------------------------------------------------------------------
// draft auto-save
// ---------------------------------------------------------------------------
describe('Compose — draft auto-save', () => {
  afterEach(() => { vi.useRealTimers() })

  it('calls onSaveDraft after the 1200ms debounce when fields change', async () => {
    vi.useFakeTimers()
    const onSaveDraft = vi.fn().mockResolvedValue(undefined)
    render(<Compose onSaveDraft={onSaveDraft} />)

    fireEvent.change(screen.getByRole('textbox', { name: /^To$/i }), {
      target: { value: 'alice@example.com' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: /subject/i }), {
      target: { value: 'Draft subject' },
    })

    // Not fired yet
    expect(onSaveDraft).not.toHaveBeenCalled()

    await act(async () => { vi.advanceTimersByTime(1300) })

    expect(onSaveDraft).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'alice@example.com', subject: 'Draft subject' }),
    )
  })

  it('resets the debounce on each change so only one save fires', async () => {
    vi.useFakeTimers()
    const onSaveDraft = vi.fn().mockResolvedValue(undefined)
    render(<Compose onSaveDraft={onSaveDraft} />)

    const subjectInput = screen.getByRole('textbox', { name: /subject/i })

    // Rapid-fire two changes
    fireEvent.change(subjectInput, { target: { value: 'Draft 1' } })
    await act(async () => { vi.advanceTimersByTime(600) })
    fireEvent.change(subjectInput, { target: { value: 'Draft 2' } })
    await act(async () => { vi.advanceTimersByTime(1300) })

    // Only one call with the latest value
    expect(onSaveDraft).toHaveBeenCalledOnce()
    expect(onSaveDraft).toHaveBeenCalledWith(
      expect.objectContaining({ subject: 'Draft 2' }),
    )
  })

  it('skips auto-save when all fields are empty', async () => {
    vi.useFakeTimers()
    const onSaveDraft = vi.fn()
    render(<Compose onSaveDraft={onSaveDraft} />)

    // Trigger a state change (toggle CC) which calls scheduleSave via useEffect
    // but fields remain empty, so save should not fire
    await act(async () => { vi.advanceTimersByTime(1300) })

    expect(onSaveDraft).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// initial prop / reply prefill
// ---------------------------------------------------------------------------
describe('Compose — initial prop prefill', () => {
  it('populates To and Subject from initial prop (reply scenario)', () => {
    render(<Compose initial={{ to: 'alice@example.com', subject: 'Re: Hello' }} />)
    expect(screen.getByRole('textbox', { name: /^To$/i })).toHaveValue('alice@example.com')
    expect(screen.getByRole('textbox', { name: /subject/i })).toHaveValue('Re: Hello')
  })

  it('shows Cc and Bcc fields when initial.cc is provided', () => {
    render(<Compose initial={{ cc: 'cc@example.com' }} />)
    expect(screen.getByRole('textbox', { name: /^Cc$/i })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /^Bcc$/i })).toBeInTheDocument()
  })

  it('shows Cc and Bcc fields when initial.bcc is provided', () => {
    render(<Compose initial={{ bcc: 'bcc@example.com' }} />)
    expect(screen.getByRole('textbox', { name: /^Bcc$/i })).toBeInTheDocument()
  })

  it('passes inReplyTo and references through to onSend', async () => {
    const onSend = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()
    render(
      <Compose
        initial={{ to: 'bob@example.com', inReplyTo: '<orig@example.com>', references: '<a@x> <orig@example.com>' }}
        onSend={onSend}
        onClose={onClose}
      />,
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^send$/i }))
    })

    expect(onSend).toHaveBeenCalledWith(
      expect.objectContaining({
        inReplyTo: '<orig@example.com>',
        references: '<a@x> <orig@example.com>',
      }),
    )
  })
})

// ---------------------------------------------------------------------------
// contact autocomplete
// ---------------------------------------------------------------------------
describe('Compose — contact autocomplete', () => {
  it('calls onContactSearch and renders suggestions', async () => {
    const onContactSearch = vi.fn().mockResolvedValue([
      { name: 'Alice Smith', email: 'alice@example.com' },
      { name: 'Alice Jones', email: 'alicejones@example.com' },
    ])

    render(<Compose onContactSearch={onContactSearch} />)

    const toInput = screen.getByRole('textbox', { name: /^To$/i })
    fireEvent.change(toInput, { target: { value: 'ali' } })

    await waitFor(() => expect(onContactSearch).toHaveBeenCalledWith('ali'))
    expect(await screen.findByText('Alice Smith')).toBeInTheDocument()
    expect(screen.getByText('alice@example.com')).toBeInTheDocument()
    expect(screen.getByText('Alice Jones')).toBeInTheDocument()
  })

  it('inserts selected contact email on mousedown', async () => {
    const onContactSearch = vi.fn().mockResolvedValue([
      { name: 'Alice Smith', email: 'alice@example.com' },
    ])

    render(<Compose onContactSearch={onContactSearch} />)

    const toInput = screen.getByRole('textbox', { name: /^To$/i })
    fireEvent.change(toInput, { target: { value: 'ali' } })

    await waitFor(() => expect(screen.queryByRole('listbox')).toBeInTheDocument())

    const option = screen.getByRole('option', { name: /alice smith/i })
    fireEvent.mouseDown(option)

    expect(toInput.value).toContain('alice@example.com')
  })

  it('navigates suggestions with ArrowDown and selects with Enter', async () => {
    const onContactSearch = vi.fn().mockResolvedValue([
      { name: 'Alice A', email: 'alicea@example.com' },
      { name: 'Alice B', email: 'aliceb@example.com' },
    ])

    render(<Compose onContactSearch={onContactSearch} />)

    const toInput = screen.getByRole('textbox', { name: /^To$/i })
    fireEvent.change(toInput, { target: { value: 'ali' } })

    await waitFor(() => expect(screen.queryByRole('listbox')).toBeInTheDocument())

    // Default: first item aria-selected=true (index 0)
    const options = screen.getAllByRole('option')
    expect(options[0]).toHaveAttribute('aria-selected', 'true')

    // Arrow down moves to second item
    fireEvent.keyDown(toInput, { key: 'ArrowDown' })
    expect(options[1]).toHaveAttribute('aria-selected', 'true')

    // Enter inserts the second option
    fireEvent.keyDown(toInput, { key: 'Enter' })
    expect(toInput.value).toContain('aliceb@example.com')
  })

  it('ArrowUp wraps back to first item', async () => {
    const onContactSearch = vi.fn().mockResolvedValue([
      { name: 'Alice A', email: 'alicea@example.com' },
      { name: 'Alice B', email: 'aliceb@example.com' },
    ])

    render(<Compose onContactSearch={onContactSearch} />)

    const toInput = screen.getByRole('textbox', { name: /^To$/i })
    fireEvent.change(toInput, { target: { value: 'ali' } })

    await waitFor(() => expect(screen.queryByRole('listbox')).toBeInTheDocument())

    const options = screen.getAllByRole('option')

    // ArrowUp on first item clamps at 0
    fireEvent.keyDown(toInput, { key: 'ArrowUp' })
    expect(options[0]).toHaveAttribute('aria-selected', 'true')
  })

  it('Escape closes the autocomplete dropdown', async () => {
    const onContactSearch = vi.fn().mockResolvedValue([
      { name: 'Alice', email: 'alice@example.com' },
    ])

    render(<Compose onContactSearch={onContactSearch} />)

    const toInput = screen.getByRole('textbox', { name: /^To$/i })
    fireEvent.change(toInput, { target: { value: 'ali' } })

    await waitFor(() => expect(screen.queryByRole('listbox')).toBeInTheDocument())

    fireEvent.keyDown(toInput, { key: 'Escape' })

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('does not show suggestions when onContactSearch returns empty array', async () => {
    const onContactSearch = vi.fn().mockResolvedValue([])

    render(<Compose onContactSearch={onContactSearch} />)

    const toInput = screen.getByRole('textbox', { name: /^To$/i })
    fireEvent.change(toInput, { target: { value: 'zzz' } })

    await waitFor(() => expect(onContactSearch).toHaveBeenCalled())
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
})
