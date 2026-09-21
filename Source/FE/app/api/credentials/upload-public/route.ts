import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const response = await fetch(`${BACKEND_URL}/credentials/upload-public`, { method: 'POST', body: formData })
    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch {
    return NextResponse.json({ error: 'Không thể kết nối tới dịch vụ lưu trữ credential.' }, { status: 502 })
  }
}
