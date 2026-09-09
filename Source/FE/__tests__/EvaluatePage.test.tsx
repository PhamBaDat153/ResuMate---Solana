import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EvaluatePage from '@/app/evaluate/page'

const validResult = {
  score: 80,
  summary: 'Phù hợp',
  suitablePoints: ['Kinh nghiệm liên quan'],
  unsuitablePoints: [],
  suggestions: ['Bổ sung số liệu'],
}

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

describe('EvaluatePage', () => {
  let fetchMock: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    fetchMock = vi.spyOn(globalThis, 'fetch')
  })

  it('validates missing CV and JD without sending a request', async () => {
    render(<EvaluatePage />)

    await userEvent.click(screen.getByRole('button', { name: 'Đánh giá' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Vui lòng chọn file CV')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sends pasted JD fields', async () => {
    const user = userEvent.setup()

    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(validResult), { status: 200 })
    )

    const { container } = render(<EvaluatePage />)

    const cvFile = new File(['cv content'], 'cv.pdf', { type: 'application/pdf' })
    const cvInput = container.querySelector('input[name="cv"]') as HTMLInputElement
    await user.upload(cvInput, cvFile)
    expect(await screen.findByText('cv.pdf')).toBeInTheDocument()

    const jdInput = screen.getByPlaceholderText(/dán mô tả/i)
    await user.type(jdInput, 'Lập trình viên React')
    expect(jdInput).toHaveValue('Lập trình viên React')

    await user.click(screen.getByRole('button', { name: /đánh giá/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    expect(fetchMock.mock.calls[0][0]).toBe('/api/evaluate')
    expect(fetchMock.mock.calls[0][1]).toHaveProperty('body')
    expect(fetchMock.mock.calls[0][1].body).toBeInstanceOf(FormData)
  })

  it('shows a pending state', async () => {
    const user = userEvent.setup()

    fetchMock.mockResolvedValue(new Promise(() => {}))

    const { container } = render(<EvaluatePage />)

    const cvFile = new File(['cv content'], 'cv.pdf', { type: 'application/pdf' })
    const cvInput = container.querySelector('input[name="cv"]') as HTMLInputElement
    await user.upload(cvInput, cvFile)

    const jdInput = screen.getByPlaceholderText(/dán mô tả/i)
    await user.type(jdInput, 'Lập trình viên React')

    await user.click(screen.getByRole('button', { name: /đánh giá/i }))

    await waitFor(() => {
      expect(screen.getAllByRole('status').length).toBeGreaterThan(0)
    })
  })

  it('sends the uploaded JD field', async () => {
    const user = userEvent.setup()

    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(validResult), { status: 200 })
    )

    const { container } = render(<EvaluatePage />)

    const cvFile = new File(['cv content'], 'cv.pdf', { type: 'application/pdf' })
    const cvInput = container.querySelector('input[name="cv"]') as HTMLInputElement
    await user.upload(cvInput, cvFile)

    await user.click(screen.getByText(/tải file/i))
    const jdFile = new File(['jd content'], 'jd.pdf', { type: 'application/pdf' })
    const jdInput = container.querySelector('input[name="jobDescriptionFile"]') as HTMLInputElement
    await user.upload(jdInput, jdFile)

    await user.click(screen.getByRole('button', { name: /đánh giá/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    const [, secondCallOptions] = fetchMock.mock.calls[0]
    expect(secondCallOptions.body).toBeInstanceOf(FormData)
  })
})
