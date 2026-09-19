import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    if (!body.ciphertextBase64 || !body.ivBase64) {
      return NextResponse.json({ error: 'Encrypted payload required' }, { status: 400 })
    }
    const response = await fetch(`${BACKEND_URL}/credentials/upload-encrypted`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await response.json()
    if (!response.ok) {
      return NextResponse.json(data, { status: response.status })
    }
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
