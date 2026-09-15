import { NextRequest, NextResponse } from 'next/server'
import { withX402 } from '@x402/next'
import { evaluationRoutes, x402Server } from '@/lib/x402Server'

const backendUrl = process.env.VITE_BACKEND_URL ?? 'http://localhost:8080'

async function matchJobs(request: NextRequest) {
  try {
    const formData = await request.formData()
    const response = await fetch(`${backendUrl}/jobs/match`, { method: 'POST', body: formData })
    const body = await response.json().catch(() => ({ error: 'Phản hồi không hợp lệ.' }))
    return NextResponse.json(body, { status: response.status })
  } catch {
    return NextResponse.json({ error: 'Không thể kết nối tới dịch vụ tìm việc.' }, { status: 502 })
  }
}

export const POST = withX402(matchJobs, evaluationRoutes, x402Server)
