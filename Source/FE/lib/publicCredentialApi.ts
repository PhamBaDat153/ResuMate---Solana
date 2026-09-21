export type PublicCredentialUploadResult = {
  manifestUri: string
  documentUri: string
  documentHash: string
  claimsHash: string
  fileName: string
  mimeType: string
}

export async function uploadPublicCredential(
  file: File,
  claims: Record<string, string>,
  claimsHash: string,
): Promise<PublicCredentialUploadResult> {
  const body = new FormData()
  body.append('file', file)
  body.append('claims', JSON.stringify(claims))
  body.append('claimsHash', claimsHash)
  const response = await fetch('/api/credentials/upload-public', { method: 'POST', body })
  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload || typeof payload.manifestUri !== 'string') {
    throw new Error(payload?.error || 'Không thể upload credential công khai.')
  }
  return payload as PublicCredentialUploadResult
}
