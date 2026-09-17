// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from './route'

describe('resume upload proxy', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('forwards multipart data and preserves response status', async () => {
    const backendFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'bad file' }), {
      status: 400, headers: { 'content-type': 'application/json' },
    }))
    vi.stubGlobal('fetch', backendFetch)
    const body = new FormData()
    body.append('file', new Blob(['%PDF']), 'cv.pdf')
    body.append('publicAcknowledged', 'true')
    const response = await POST(new NextRequest('http://localhost/api/resume-versions/upload', { method: 'POST', body }))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'bad file' })
    expect(backendFetch).toHaveBeenCalledWith('http://localhost:8080/resume-versions/upload', expect.objectContaining({ method: 'POST' }))
  })

  it('maps an unavailable backend without exposing secrets', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('CLOUDINARY_API_SECRET=secret')))
    const response = await POST(new NextRequest('http://localhost/api/resume-versions/upload', { method: 'POST', body: new FormData() }))
    expect(response.status).toBe(502)
    expect(JSON.stringify(await response.json())).not.toContain('secret')
  })
})
