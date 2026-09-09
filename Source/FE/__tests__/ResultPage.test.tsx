import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ResultPage from '@/app/result/page'

const result = {
  score: 91,
  summary: 'Kết quả từ backend',
  suitablePoints: ['Có kinh nghiệm phù hợp'],
  unsuitablePoints: [],
  suggestions: ['Bổ sung thành tựu'],
}

describe('ResultPage', () => {
  it('renders an empty state without route result data', async () => {
    render(await ResultPage({ searchParams: Promise.resolve({}) }))

    expect(screen.getByText('Chưa có kết quả đánh giá')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Bắt đầu đánh giá' })
    ).toHaveAttribute('href', '/evaluate')
  })

  it('renders backend values and empty collection messages', async () => {
    const data = encodeURIComponent(JSON.stringify(result))
    render(await ResultPage({ searchParams: Promise.resolve({ data }) }))

    expect(screen.getByText('91')).toBeInTheDocument()
    expect(screen.getByText('Kết quả từ backend')).toBeInTheDocument()
    expect(
      screen.getByText('Không có điểm cần cải thiện nào.')
    ).toBeInTheDocument()
  })
})
