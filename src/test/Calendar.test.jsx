import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Calendar from '../components/Calendar.jsx'

function mockClient(events = []) {
  return {
    listEvents: vi.fn(async () => events),
    createEvent: vi.fn(async () => ({ created: true })),
    updateEvent: vi.fn(async () => ({ updated: true })),
    deleteEvent: vi.fn(async () => null),
  }
}

// A fixed event today so it lands in the fetched window across views.
const todayAt = (h) => {
  const d = new Date(); d.setHours(h, 0, 0, 0); return d.toISOString()
}

describe('<Calendar/>', () => {
  beforeEach(() => { window.confirm = vi.fn(() => true) })

  it('renders month/week/day/agenda view tabs', async () => {
    render(<Calendar client={mockClient()} />)
    for (const label of ['Month', 'Week', 'Day', 'Agenda']) {
      expect(screen.getByRole('tab', { name: label })).toBeInTheDocument()
    }
  })

  it('creates an event via the New event editor', async () => {
    const client = mockClient()
    render(<Calendar client={client} />)
    fireEvent.click(screen.getByRole('button', { name: /new event/i }))
    const dialog = await screen.findByRole('dialog', { name: /new event/i })
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Planning' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(client.createEvent).toHaveBeenCalled())
    expect(client.createEvent.mock.calls[0][0]).toMatchObject({ summary: 'Planning' })
  })

  it('does not save an event without a title', async () => {
    const client = mockClient()
    render(<Calendar client={client} />)
    fireEvent.click(screen.getByRole('button', { name: /new event/i }))
    await screen.findByRole('dialog', { name: /new event/i })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Add a title')).toBeInTheDocument()
    expect(client.createEvent).not.toHaveBeenCalled()
  })

  it('edits an existing event from the agenda view', async () => {
    const client = mockClient([
      { uid: 'e1', summary: 'Standup', start: todayAt(9), end: todayAt(10), path: '/cal/e1.ics' },
    ])
    render(<Calendar client={client} defaultView="agenda" />)
    fireEvent.click(await screen.findByText('Standup'))
    const dialog = await screen.findByRole('dialog', { name: /edit event/i })
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Standup (moved)' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(client.updateEvent).toHaveBeenCalled())
    const [uid, ev] = client.updateEvent.mock.calls[0]
    expect(uid).toBe('e1')
    expect(ev).toMatchObject({ summary: 'Standup (moved)', path: '/cal/e1.ics' })
  })

  it('deletes an event from the editor', async () => {
    const client = mockClient([
      { uid: 'e1', summary: 'Standup', start: todayAt(9), end: todayAt(10) },
    ])
    render(<Calendar client={client} defaultView="agenda" />)
    fireEvent.click(await screen.findByText('Standup'))
    await screen.findByRole('dialog', { name: /edit event/i })
    fireEvent.click(screen.getByRole('button', { name: /delete/i }))
    await waitFor(() => expect(client.deleteEvent).toHaveBeenCalledWith('e1'))
  })
})
