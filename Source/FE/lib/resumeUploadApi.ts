export type ResumeUploadResult = {
  contentUri: string
  providerId: string
  mediaType: string
  fileName: string
  size: number
  contentHash: string
}

export async function uploadResumeDocument(file: File): Promise<ResumeUploadResult> {
  const body = new FormData()
  body.append('file', file)
  body.append('publicAcknowledged', 'true')
  const response = await fetch('/api/resume-versions/upload', { method: 'POST', body })
  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
      ? payload.error : 'Không thể tải CV lên Cloudinary.'
    throw new Error(message)
  }
  if (!payload || typeof payload !== 'object') throw new Error('Phản hồi upload không hợp lệ.')
  const result = payload as Record<string, unknown>
  if (typeof result.contentUri !== 'string' || typeof result.contentHash !== 'string' ||
      typeof result.fileName !== 'string' || typeof result.mediaType !== 'string' ||
      typeof result.providerId !== 'string' || typeof result.size !== 'number') {
    throw new Error('Phản hồi upload không hợp lệ.')
  }
  return result as ResumeUploadResult
}
