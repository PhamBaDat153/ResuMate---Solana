'use client'

import { useState } from 'react'
import type { ResumeVersionAccount } from '@/lib/resumeVersionProgram'
import { Button } from '@/components/ui/button'

function validHttpsUri(value: string): URL | null {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'https:' && parsed.hostname ? parsed : null
  } catch {
    return null
  }
}

function mediaType(uri: string): 'pdf' | 'docx' | 'other' {
  return uri.toLowerCase().endsWith('.pdf') ? 'pdf' : uri.toLowerCase().endsWith('.docx') ? 'docx' : 'other'
}

export function PublicResumeView({ version }: { version: ResumeVersionAccount }) {
  const [previewError, setPreviewError] = useState(false)
  const uri = validHttpsUri(version.contentUri)
  const type = uri ? mediaType(uri.pathname) : 'other'

  return (
    <div className="rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">Version {version.version.toString()}</p>
        <span className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">Public</span>
      </div>
      {!uri ? (
        <p className="mt-3 text-sm text-destructive" role="alert">URI public không hợp lệ, không thể mở resume.</p>
      ) : (
        <>
          <p className="mt-2 break-all font-mono text-xs text-muted-foreground">{uri.href}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm"><a href={uri.href} target="_blank" rel="noopener noreferrer">Mở resume</a></Button>
            <Button asChild size="sm"><a href={uri.href} download target="_blank" rel="noopener noreferrer">Tải xuống</a></Button>
          </div>
          {type === 'pdf' ? (
            <div className="mt-4">
              <p className="mb-2 text-xs text-muted-foreground" role="status">{previewError ? 'Không thể preview inline. Hãy mở tab mới hoặc tải file.' : 'Preview PDF public'}</p>
              <iframe src={uri.href} title={`Resume version ${version.version.toString()}`} className="h-[min(70vh,720px)] w-full rounded-lg border border-border bg-white" onError={() => setPreviewError(true)} />
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">DOCX hoặc định dạng này không preview trực tiếp. Hãy mở hoặc tải file gốc.</p>
          )}
        </>
      )}
      <p className="mt-3 text-xs text-muted-foreground">File public có thể vẫn tồn tại sau khi visibility hoặc version thay đổi.</p>
    </div>
  )
}
