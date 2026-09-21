'use client'

import { useState } from 'react'
import type { ResumeVersionAccount } from '@/lib/resumeVersionProgram'
import { Button } from '@/components/ui/button'

export type VerifiedResumeVersion = ResumeVersionAccount & {
  fileName: string
  mediaType: string
  size: number
  verified: true
}

export type ResumePreviewDocument = VerifiedResumeVersion

export type ResumePreviewMode = 'pdf' | 'docx' | 'other'

export function classifyResumePreview(mediaType: string): ResumePreviewMode {
  if (mediaType.toLowerCase() === 'application/pdf') return 'pdf'
  if (mediaType.toLowerCase() === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx'
  return 'other'
}

export function validatePublicResumeUri(value: string): URL | null {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || !url.hostname) return null
    return url
  } catch {
    return null
  }
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`
  return `${(size / 1024).toFixed(size >= 1024 * 1024 ? 1 : 0)} KB`
}

export function ResumePreview({ version }: { version: VerifiedResumeVersion }) {
  const [previewError, setPreviewError] = useState(false)
  const uri = validatePublicResumeUri(version.contentUri)
  const mode = classifyResumePreview(version.mediaType)

  if (!version.verified || version.isRevoked) return null

  return (
    <section className="mt-4 rounded-xl border border-border bg-secondary/20 p-4" aria-labelledby="resume-preview-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="resume-preview-title" className="font-display font-semibold">Xem resume đã xác minh</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {version.fileName} · {version.mediaType} · {formatBytes(version.size)} · Version {version.version.toString()}
          </p>
        </div>
        {uri && (
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={uri.href} target="_blank" rel="noopener noreferrer">
                Mở trong tab mới
              </a>
            </Button>
            <Button asChild size="sm">
              <a href={uri.href} download={version.fileName} target="_blank" rel="noopener noreferrer">
                Tải xuống
              </a>
            </Button>
          </div>
        )}
      </div>

      <p className="mt-3 rounded-lg border border-border bg-background/50 px-3 py-2 text-xs text-muted-foreground">
        File và URI Cloudinary này là công khai. `is_public` không phải cơ chế bảo vệ quyền truy cập file.
      </p>

      {!uri ? (
        <p className="mt-4 text-sm text-destructive" role="alert">
          URI public của resume không hợp lệ, không thể mở trực tiếp.
        </p>
      ) : mode === 'pdf' ? (
        <div className="mt-4">
          <p className="mb-3 text-sm text-muted-foreground" role="status">
            {previewError
              ? 'Không thể hiển thị inline. Bạn có thể mở tab mới hoặc tải file gốc.'
              : 'Nếu preview không tải được, hãy mở tab mới hoặc tải file gốc.'}
          </p>
          <iframe
            src={uri.href}
            title={`Preview ${version.fileName}`}
            className="h-[min(70vh,720px)] w-full rounded-lg border border-border bg-white"
            onError={() => setPreviewError(true)}
          />
        </div>
      ) : mode === 'docx' ? (
        <p className="mt-4 text-sm text-muted-foreground">
          DOCX không được preview trực tiếp trong MVP. Hãy mở hoặc tải file gốc.
        </p>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          Định dạng này không hỗ trợ preview inline. Hãy mở hoặc tải file gốc.
        </p>
      )}
    </section>
  )
}
