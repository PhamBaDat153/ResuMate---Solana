export interface CredentialPackageUploadResponse {
  packageUri: string
  providerId: string
  documentHash: string
  claimsHash: string
  sizeBytes: number
}

export async function uploadEncryptedCredentialPackage(payload: {
  algorithm: string
  ivBase64: string
  ciphertextBase64: string
  documentHash: string
  claimsHash: string
  mimeType: string
  originalFileName: string
}): Promise<CredentialPackageUploadResponse> {
  const response = await fetch('/api/credentials/upload-encrypted', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Upload failed' }))
    throw new Error(error.error || `Upload failed with status ${response.status}`)
  }
  return response.json()
}
