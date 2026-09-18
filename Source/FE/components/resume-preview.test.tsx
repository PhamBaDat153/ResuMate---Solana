import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ResumePreview, classifyResumePreview, validatePublicResumeUri, type VerifiedResumeVersion } from './resume-preview'
import { address } from '@solana/kit'

const OWNER = address('8SVXDqsBg2qQGxddweHmkG8rehnAzRx6uesjrv8TcR63')
const RESUME = address('11111111111111111111111111111111')
const BASE = {
  address: RESUME,
  owner: OWNER,
  resume: RESUME,
  version: BigInt(0),
  contentHash: new Uint8Array(32),
  metadataHash: new Uint8Array(32),
  contentUri: 'https://res.cloudinary.com/demo/raw/upload/cv.pdf',
  createdAt: BigInt(1),
  isRevoked: false,
  bump: 1,
  fileName: 'cv.pdf',
  mediaType: 'application/pdf',
  size: 1024,
  verified: true as const,
}

function version(overrides: Partial<VerifiedResumeVersion> = {}): VerifiedResumeVersion {
  return { ...BASE, ...overrides }
}

describe('resume preview', () => {
  afterEach(cleanup)

  it('classifies PDF, DOCX, and unknown media types', () => {
    expect(classifyResumePreview('application/pdf')).toBe('pdf')
    expect(classifyResumePreview('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe('docx')
    expect(classifyResumePreview('application/octet-stream')).toBe('other')
  })

  it('accepts only HTTPS URLs without rewriting them', () => {
    expect(validatePublicResumeUri('https://example.com/cv.pdf')?.href).toBe('https://example.com/cv.pdf')
    expect(validatePublicResumeUri('http://example.com/cv.pdf')).toBeNull()
    expect(validatePublicResumeUri('not-a-url')).toBeNull()
  })

  it('renders a verified PDF with original URI and fallbacks', () => {
    render(<ResumePreview version={version()} />)
    const frame = screen.getByTitle('Preview cv.pdf') as HTMLIFrameElement
    expect(frame.src).toBe(BASE.contentUri)
    expect(screen.getByRole('link', { name: 'Mở trong tab mới' })).toHaveAttribute('href', BASE.contentUri)
    expect(screen.getByRole('link', { name: 'Tải xuống' })).toHaveAttribute('href', BASE.contentUri)
    expect(screen.getByText(/File và URI Cloudinary này là công khai/)).toBeInTheDocument()
  })

  it('keeps PDF fallbacks after inline rendering fails', async () => {
    render(<ResumePreview version={version()} />)
    fireEvent.error(screen.getByTitle('Preview cv.pdf'))
    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument())
    expect(screen.getByRole('link', { name: 'Mở trong tab mới' })).toBeInTheDocument()
  })

  it('renders DOCX as download-only', () => {
    render(<ResumePreview version={version({ fileName: 'cv.docx', mediaType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })} />)
    expect(screen.queryByTitle('Preview cv.docx')).not.toBeInTheDocument()
    expect(screen.getByText(/DOCX không được preview trực tiếp/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Tải xuống' })).toBeInTheDocument()
  })

  it('suppresses revoked or unverified versions and invalid URI actions', () => {
    const { rerender } = render(<ResumePreview version={version({ isRevoked: true })} />)
    expect(screen.queryByRole('heading', { name: 'Xem resume đã xác minh' })).not.toBeInTheDocument()
    rerender(<ResumePreview version={version({ contentUri: 'http://example.com/cv.pdf' })} />)
    expect(screen.getByRole('alert')).toHaveTextContent('URI public của resume không hợp lệ')
    expect(screen.queryByRole('link', { name: 'Tải xuống' })).not.toBeInTheDocument()
  })
})
