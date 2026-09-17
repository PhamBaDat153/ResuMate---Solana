import { NextRequest, NextResponse } from 'next/server'

const backendUrl = process.env.VITE_BACKEND_URL ?? 'http://localhost:8080'

export async function POST(request: NextRequest) {
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Yêu cầu upload không hợp lệ.' }, { status: 400 })
  }
  try {
    const response = await fetch(`${backendUrl}/resume-versions/upload`, { method: 'POST', body: formData })
    const type = response.headers.get('content-type') ?? ''
    const payload = type.includes('application/json') ? await response.json() : { error: 'Phản hồi storage không hợp lệ.' }
    return NextResponse.json(payload, { status: response.status })
  } catch {
    return NextResponse.json({ error: 'Không thể kết nối tới dịch vụ lưu trữ CV.' }, { status: 502 })
  }
}
