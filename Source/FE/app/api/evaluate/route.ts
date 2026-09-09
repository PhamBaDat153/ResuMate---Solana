import { NextRequest, NextResponse } from 'next/server'
import { withX402 } from '@x402/next'
import { evaluationRoutes, x402Server } from '@/lib/x402Server'

const backendUrl = process.env.VITE_BACKEND_URL ?? 'http://localhost:8080'

async function evaluate(request: NextRequest) {
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Yêu cầu tải file không hợp lệ.' }, { status: 400 })
  }

  try {
    const response = await fetch(`${backendUrl}/evaluate`, {
      method: 'POST',
      body: formData,
    })
    const contentType = response.headers.get('content-type') ?? ''
    const body = contentType.includes('application/json')
      ? await response.json()
      : { error: 'Phản hồi từ máy chủ không hợp lệ.' }

    if (!response.ok) {
      const message =
        typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string'
          ? body.error
          : 'Không thể đánh giá CV. Vui lòng thử lại.'
      return NextResponse.json({ error: message }, { status: response.status })
    }

    return NextResponse.json(body)
  } catch {
    return NextResponse.json(
      { error: 'Không thể kết nối tới máy chủ đánh giá. Vui lòng thử lại.' },
      { status: 502 },
    )
  }
}

export const POST = withX402(evaluate, evaluationRoutes, x402Server)
