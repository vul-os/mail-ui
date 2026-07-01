/**
 * compose-attachments.test.jsx — drag-drop / picker attachment upload in compose.
 */
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import Compose from '../components/Compose.jsx'

function fileInput(container) {
  return container.querySelector('input[type="file"]')
}

describe('Compose — attachments', () => {
  it('disables the attach button when no upload endpoint is wired', () => {
    render(<Compose onSend={() => {}} />)
    expect(screen.getByRole('button', { name: /attach files \(unavailable\)/i })).toBeDisabled()
  })

  it('exposes an enabled attach button when onUploadAttachment is provided', () => {
    render(<Compose onSend={() => {}} onUploadAttachment={vi.fn()} />)
    expect(screen.getByRole('button', { name: /^attach files$/i })).toBeEnabled()
  })

  it('uploads a picked file, shows a chip, and includes it in the sent draft', async () => {
    const onUploadAttachment = vi.fn().mockResolvedValue({ id: 'att-9', filename: 'report.pdf', size: 2048, contentType: 'application/pdf' })
    const onSend = vi.fn().mockResolvedValue(undefined)
    const { container } = render(
      <Compose initial={{ to: 'a@b.com' }} onSend={onSend} onUploadAttachment={onUploadAttachment} />,
    )

    const file = new File(['pdf'], 'report.pdf', { type: 'application/pdf' })
    await act(async () => { fireEvent.change(fileInput(container), { target: { files: [file] } }) })

    expect(onUploadAttachment).toHaveBeenCalledWith(file)
    // Chip lands with the (server-confirmed) filename.
    expect(await screen.findByText('report.pdf')).toBeInTheDocument()

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^send$/i })) })
    expect(onSend).toHaveBeenCalledWith(
      expect.objectContaining({ attachments: [expect.objectContaining({ id: 'att-9', filename: 'report.pdf' })] }),
    )
  })

  it('removes a staged attachment before sending', async () => {
    const onUploadAttachment = vi.fn().mockResolvedValue({ id: 'att-1', filename: 'a.txt', size: 4, contentType: 'text/plain' })
    const { container } = render(<Compose initial={{ to: 'a@b.com' }} onSend={vi.fn()} onUploadAttachment={onUploadAttachment} />)

    const file = new File(['data'], 'a.txt', { type: 'text/plain' })
    await act(async () => { fireEvent.change(fileInput(container), { target: { files: [file] } }) })
    expect(await screen.findByText('a.txt')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /remove a\.txt/i }))
    await waitFor(() => expect(screen.queryByText('a.txt')).not.toBeInTheDocument())
  })

  it('drops a failed upload chip and does not attach it', async () => {
    const onUploadAttachment = vi.fn().mockRejectedValue(new Error('boom'))
    const onSend = vi.fn().mockResolvedValue(undefined)
    const { container } = render(<Compose initial={{ to: 'a@b.com' }} onSend={onSend} onUploadAttachment={onUploadAttachment} />)

    const file = new File(['x'], 'bad.bin', { type: 'application/octet-stream' })
    await act(async () => { fireEvent.change(fileInput(container), { target: { files: [file] } }) })

    await waitFor(() => expect(screen.queryByText('bad.bin')).not.toBeInTheDocument())
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^send$/i })) })
    // No attachments key when nothing uploaded successfully.
    expect(onSend).toHaveBeenCalledWith(expect.not.objectContaining({ attachments: expect.anything() }))
  })
})
