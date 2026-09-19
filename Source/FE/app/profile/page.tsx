'use client'

import { useCallback, useEffect, useState } from 'react'
import { address, type Address } from '@solana/kit'
import { useClient } from '@solana/react'
import {
  useConnect,
  useConnectedWallet,
  useDisconnect,
  useWallets,
} from '@solana/kit-plugin-wallet/react'
import type { SolanaWalletClient } from '@/components/solana-provider'
import {
  createProfile,
  createResume,
  deriveProfileAddress,
  deriveResumeAddress,
  fetchOwnedResumes,
  fetchProfile,
  type ResumeAccount,
  type UserProfile,
} from '@/lib/profileProgram'
import { UploadZone } from '@/components/upload-zone'
import { ResumePreview, type VerifiedResumeVersion } from '@/components/resume-preview'
import { uploadResumeDocument } from '@/lib/resumeUploadApi'
import {
  bytesToHex,
  deriveResumeVersionAddress,
  hashResumeMetadata,
  publishResumeVersion,
  sha256,
  type PreparedResumeVersion,
  type ResumeVersionAccount,
} from '@/lib/resumeVersionProgram'
import { fetchProfileCredentials, acceptCredential, type CredentialAccount } from '@/lib/credentialProgram'

type ProfileState = 'idle' | 'loading' | 'missing' | 'existing' | 'creating' | 'error'
type ResumeState = 'idle' | 'loading' | 'ready' | 'creating' | 'refreshing' | 'success' | 'conflict' | 'error'
type PublishState = 'idle' | 'hashing' | 'uploading' | 'prepared' | 'signing' | 'verifying' | 'success' | 'stale' | 'error'

export function getProfileError(error: unknown): string {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
  if (message.includes('reject') || message.includes('cancel') || message.includes('declin')) {
    return 'Bạn đã từ chối ký giao dịch. Hãy thử lại khi sẵn sàng.'
  }
  if (message.includes('insufficient') || message.includes('fund') || message.includes('lamport')) {
    return 'Ví không đủ SOL để trả phí và rent tạo profile.'
  }
  if (message.includes('already') || message.includes('exist') || message.includes('in use')) {
    return 'Profile đã tồn tại. Hãy tải lại trạng thái ví để tiếp tục.'
  }
  if (message.includes('network') || message.includes('rpc') || message.includes('blockhash')) {
    return 'Không thể kết nối đúng mạng Solana. Kiểm tra network/RPC rồi thử lại.'
  }
  return error instanceof Error ? error.message : 'Không thể tạo profile. Vui lòng thử lại.'
}

export function getResumeError(error: unknown): { message: string; conflict: boolean } {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
  if (message.includes('reject') || message.includes('cancel') || message.includes('declin')) {
    return { message: 'Bạn đã từ chối ký giao dịch tạo resume. Hãy thử lại khi sẵn sàng.', conflict: false }
  }
  if (message.includes('insufficient') || message.includes('fund') || message.includes('lamport')) {
    return { message: 'Ví không đủ SOL để trả phí và rent tạo resume.', conflict: false }
  }
  if (message.includes('invalidid') || message.includes('already') || message.includes('exist') || message.includes('in use')) {
    return { message: 'Resume ID đã thay đổi hoặc account đã tồn tại. Trạng thái profile đã được làm mới.', conflict: true }
  }
  if (message.includes('không hợp lệ') || message.includes('không khớp') || message.includes('verify')) {
    return { message: 'Dữ liệu resume on-chain không hợp lệ hoặc không khớp yêu cầu. Hãy tải lại trạng thái.', conflict: false }
  }
  if (message.includes('network') || message.includes('rpc') || message.includes('blockhash') || message.includes('program')) {
    return { message: 'Không tìm thấy chương trình ResuMate trên network/RPC hiện tại. Kiểm tra cấu hình rồi thử lại.', conflict: false }
  }
  return {
    message: error instanceof Error ? error.message : 'Không thể tạo resume. Vui lòng thử lại.',
    conflict: false,
  }
}

export function getPublishError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  const lower = message.toLowerCase()
  if (lower.includes('reject') || lower.includes('cancel')) return 'Bạn đã từ chối ký. Bản upload đã chuẩn bị vẫn có thể được thử lại.'
  if (lower.includes('insufficient') || lower.includes('lamport') || lower.includes('fund')) return 'Ví không đủ SOL để tạo ResumeVersion.'
  if (lower.includes('stale') || lower.includes('version đã thay đổi') || lower.includes('already') || lower.includes('in use')) return 'Version của resume đã thay đổi; bản chuẩn bị đã stale và sẽ không được tự động gửi.'
  if (lower.includes('cloudinary') || lower.includes('storage') || lower.includes('upload')) return `Không thể upload CV: ${message}`
  if (lower.includes('hash') || lower.includes('uri') || lower.includes('url')) return message
  if (lower.includes('rpc') || lower.includes('network') || lower.includes('program')) return 'Không thể xác minh chương trình trên network/RPC hiện tại.'
  return message || 'Không thể công bố phiên bản resume.'
}

export default function ProfilePage() {
  const client = useClient<SolanaWalletClient>()
  const wallets = useWallets(client)
  const connectedWallet = useConnectedWallet(client)
  const connect = useConnect(client)
  const disconnect = useDisconnect(client)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [profileAddress, setProfileAddress] = useState<string | null>(null)
  const [state, setState] = useState<ProfileState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [nextResumeAddress, setNextResumeAddress] = useState<string | null>(null)
  const [createdResume, setCreatedResume] = useState<ResumeAccount | null>(null)
  const [resumeState, setResumeState] = useState<ResumeState>('idle')
  const [resumeError, setResumeError] = useState<string | null>(null)
  const [ownedResumes, setOwnedResumes] = useState<ResumeAccount[]>([])
  const [selectedResume, setSelectedResume] = useState<ResumeAccount | null>(null)
  const [publishFile, setPublishFile] = useState<File | null>(null)
  const [publicAcknowledged, setPublicAcknowledged] = useState(false)
  const [preparedVersion, setPreparedVersion] = useState<PreparedResumeVersion | null>(null)
  const [publishedVersion, setPublishedVersion] = useState<ResumeVersionAccount | null>(null)
  const [publishState, setPublishState] = useState<PublishState>('idle')
  const [publishError, setPublishError] = useState<string | null>(null)
  const [credentials, setCredentials] = useState<CredentialAccount[]>([])
  const [assetState, setAssetState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [assetError, setAssetError] = useState<string | null>(null)

  const loadProfile = useCallback(async () => {
    if (!connectedWallet) {
      setProfile(null)
      setProfileAddress(null)
      setState('idle')
      setNextResumeAddress(null)
      setCreatedResume(null)
      setResumeState('idle')
      setOwnedResumes([])
      setSelectedResume(null)
      setCredentials([])
      setAssetState('idle')
      return
    }

    setState('loading')
    setError(null)
    try {
      const owner = address(connectedWallet.account.address) as Address
      const derivedAddress = await deriveProfileAddress(owner)
      setProfileAddress(derivedAddress)
      const currentProfile = await fetchProfile(client, owner)
      setProfile(currentProfile)
      setState(currentProfile ? 'existing' : 'missing')
      if (currentProfile) {
        setResumeState('loading')
        setNextResumeAddress(await deriveResumeAddress(owner, currentProfile.resumeCount))
        setResumeState('ready')
        const currentResumes = await fetchOwnedResumes(client, owner, currentProfile.resumeCount)
        setOwnedResumes(currentResumes)
        setSelectedResume((selected) => currentResumes.find((resume) => resume.address === selected?.address) ?? currentResumes[0] ?? null)
        setAssetState('loading')
        setAssetError(null)
        try {
          setCredentials(await fetchProfileCredentials(client, owner, currentProfile.credentialCount))
          setAssetState('ready')
        } catch (assetLoadError) {
          setCredentials([])
          setAssetState('error')
          setAssetError(assetLoadError instanceof Error ? assetLoadError.message : 'Không thể đọc credential của profile.')
        }
      } else {
        setNextResumeAddress(null)
        setResumeState('idle')
        setCredentials([])
        setAssetState('idle')
      }
    } catch (loadError) {
      setProfile(null)
      setState('error')
      setError(getProfileError(loadError))
    }
  }, [client, connectedWallet])

  useEffect(() => {
    const refresh = window.setTimeout(() => void loadProfile(), 0)
    return () => window.clearTimeout(refresh)
  }, [loadProfile])

  const handleCreate = async () => {
    if (!connectedWallet?.signer || state !== 'missing') return

    setState('creating')
    setError(null)
    try {
      await createProfile(client, address(connectedWallet.account.address) as Address)
      await loadProfile()
    } catch (createError) {
      setState('error')
      setError(getProfileError(createError))
    }
  }

  const handleCreateResume = async () => {
    if (!connectedWallet?.signer || !profile || resumeState !== 'ready') return

    const owner = address(connectedWallet.account.address) as Address
    const resumeId = profile.resumeCount
    setResumeState('creating')
    setResumeError(null)
    setCreatedResume(null)
    try {
      const result = await createResume(client, owner, resumeId, () => setResumeState('refreshing'))
      setProfile(result.profile)
      setCreatedResume(result.resume)
      setNextResumeAddress(await deriveResumeAddress(owner, result.profile.resumeCount))
      setResumeState('success')
    } catch (createError) {
      const mappedError = getResumeError(createError)
      if (mappedError.conflict) {
        setResumeState('conflict')
        try {
          const refreshedProfile = await fetchProfile(client, owner)
          setProfile(refreshedProfile)
          if (refreshedProfile) {
            setNextResumeAddress(await deriveResumeAddress(owner, refreshedProfile.resumeCount))
          }
        } catch {
          // Keep the original transaction conflict as the actionable error.
        }
      } else {
        setResumeState('error')
      }
      setResumeError(mappedError.message)
    }
  }

  const resetResumeAction = async () => {
    setCreatedResume(null)
    setResumeError(null)
    await loadProfile()
  }

  const handlePublishFileChange = (file: File | null) => {
    setPublishFile(file)
    setPreparedVersion(null)
    setPublishedVersion(null)
    setPublishError(null)
    setPublishState('idle')
  }

  const handlePrepareVersion = async () => {
    if (!publishFile || !selectedResume || !publicAcknowledged) return
    setPublishState('hashing')
    setPublishError(null)
    try {
      const bytes = await new Response(publishFile).arrayBuffer()
      const contentHash = await sha256(bytes)
      const metadataHash = await hashResumeMetadata(publishFile.name, publishFile.type, publishFile.size)
      setPublishState('uploading')
      const upload = await uploadResumeDocument(publishFile)
      if (upload.contentHash.toLowerCase() !== bytesToHex(contentHash)) {
        throw new Error('Hash file từ storage không khớp với file đã chọn.')
      }
      if (new TextEncoder().encode(upload.contentUri).length > 200) throw new Error('Cloudinary URL vượt quá giới hạn 200 byte.')
      const versionAddress = await deriveResumeVersionAddress(selectedResume.address, selectedResume.versionCount)
      setPreparedVersion({
        resume: selectedResume.address,
        expectedVersion: selectedResume.versionCount,
        contentHash,
        metadataHash,
        contentHashHex: upload.contentHash.toLowerCase(),
        metadataHashHex: bytesToHex(metadataHash),
        contentUri: upload.contentUri,
        fileName: upload.fileName,
        mediaType: upload.mediaType,
        size: upload.size,
        versionAddress,
      })
      setPublishState('prepared')
    } catch (prepareError) {
      setPublishState('error')
      setPublishError(getPublishError(prepareError))
    }
  }

  const handlePublishVersion = async () => {
    if (!preparedVersion || !connectedWallet?.signer || !selectedResume) return
    setPublishState('signing')
    setPublishError(null)
    try {
      const owner = address(connectedWallet.account.address) as Address
      const result = await publishResumeVersion(client, owner, preparedVersion, () => setPublishState('verifying'))
      setPublishedVersion(result.version)
      setOwnedResumes((items) => items.map((item) => item.address === result.resume.address ? result.resume : item))
      setSelectedResume(result.resume)
      setPublishState('success')
    } catch (publishFailure) {
      const message = getPublishError(publishFailure)
      setPublishState(message.includes('stale') || message.includes('thay đổi') ? 'stale' : 'error')
      setPublishError(message)
    }
  }

  return (
    <main className="min-h-screen bg-bg1 px-6 py-16 text-foreground">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted">ResuMate · On-chain identity</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">Profile của bạn</h1>
          <p className="mt-3 max-w-2xl leading-7 text-muted">
            Tạo profile on-chain để bắt đầu quản lý resume và credential. Profile chỉ lưu identity wallet và các bộ đếm, không lưu thông tin cá nhân.
          </p>
        </header>

        <section className="rounded-2xl border border-border-low bg-card p-6 shadow-[0_20px_80px_-50px_rgba(0,0,0,0.35)]">
          {!connectedWallet ? (
            <div className="flex flex-col gap-4">
              <p className="text-muted">Kết nối ví Solana để kiểm tra hoặc tạo profile.</p>
              {wallets.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {wallets.map((wallet) => (
                    <button
                      key={wallet.name}
                      type="button"
                      onClick={() => connect.dispatch(wallet)}
                      disabled={connect.isRunning}
                      className="rounded-lg bg-foreground px-4 py-2 font-medium text-background transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {connect.isRunning ? 'Đang kết nối...' : `Kết nối ${wallet.name}`}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted">Không tìm thấy ví tương thích Wallet Standard.</p>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-muted">Wallet owner</p>
                  <p className="mt-1 break-all font-mono text-sm">{connectedWallet.account.address}</p>
                </div>
                <button
                  type="button"
                  onClick={() => disconnect.dispatch()}
                  disabled={state === 'creating' || disconnect.isRunning}
                  className="rounded-lg border border-border-low px-3 py-2 text-sm font-medium transition hover:border-foreground/30 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Ngắt kết nối
                </button>
              </div>

              {state === 'loading' && <p className="text-muted" role="status">Đang kiểm tra profile trên Solana...</p>}
              {state === 'missing' && (
                <div className="flex flex-col gap-4">
                  <p>Wallet này chưa có profile on-chain.</p>
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={!connectedWallet.signer}
                    className="w-fit rounded-lg bg-foreground px-4 py-2 font-medium text-background transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Tạo profile
                  </button>
                  {profileAddress && <p className="break-all text-xs text-muted">Profile PDA: {profileAddress}</p>}
                </div>
              )}
              {state === 'creating' && <p className="text-muted" role="status">Đang chờ ví ký và xác nhận giao dịch...</p>}
              {state === 'existing' && profile && (
                <div className="flex flex-col gap-8">
                  <dl className="grid gap-4 sm:grid-cols-2">
                    <div><dt className="text-sm text-muted">Profile PDA</dt><dd className="mt-1 break-all font-mono text-xs">{profile.address}</dd></div>
                    <div><dt className="text-sm text-muted">Owner</dt><dd className="mt-1 break-all font-mono text-xs">{profile.owner}</dd></div>
                    <div><dt className="text-sm text-muted">Resume count</dt><dd className="mt-1 text-xl font-semibold">{profile.resumeCount.toString()}</dd></div>
                    <div><dt className="text-sm text-muted">Credential count</dt><dd className="mt-1 text-xl font-semibold">{profile.credentialCount.toString()}</dd></div>
                  </dl>

                  <section className="border-t border-border-low pt-6" aria-labelledby="create-resume-title">
                    <h2 id="create-resume-title" className="text-xl font-semibold">Tạo resume on-chain</h2>
                    <p className="mt-2 text-sm leading-6 text-muted">
                      Bước này chỉ tạo container resume riêng tư trên Solana. Nội dung CV, hash và URI chỉ được thêm ở bước công bố phiên bản riêng biệt.
                    </p>

                    {(resumeState === 'loading' || resumeState === 'creating' || resumeState === 'refreshing') && (
                      <p className="mt-4 text-sm text-muted" role="status">
                        {resumeState === 'loading'
                          ? 'Đang xác định Resume PDA tiếp theo...'
                          : resumeState === 'creating'
                            ? 'Đang chờ ví ký và xác nhận giao dịch tạo resume...'
                            : 'Giao dịch đã gửi, đang xác minh profile và Resume PDA...'}
                      </p>
                    )}

                    {(resumeState === 'ready' || resumeState === 'success') && nextResumeAddress && (
                      <div className="mt-4 rounded-xl border border-border-low bg-cream/40 p-4">
                        <p className="text-sm text-muted">Resume tiếp theo</p>
                        <p className="mt-1 font-semibold">ID {profile.resumeCount.toString()}</p>
                        <p className="mt-2 break-all font-mono text-xs text-muted">PDA: {nextResumeAddress}</p>
                        <button
                          type="button"
                          onClick={handleCreateResume}
                          disabled={resumeState !== 'ready' || !connectedWallet.signer}
                          className="mt-4 rounded-lg bg-foreground px-4 py-2 font-medium text-background transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Tạo resume
                        </button>
                      </div>
                    )}

                    {resumeState === 'success' && createdResume && (
                      <div className="mt-4 rounded-xl border border-border-low p-4" role="status">
                        <p className="font-semibold">Resume đã được xác minh on-chain</p>
                        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                          <div><dt className="text-xs text-muted">Resume PDA</dt><dd className="break-all font-mono text-xs">{createdResume.address}</dd></div>
                          <div><dt className="text-xs text-muted">Owner</dt><dd className="break-all font-mono text-xs">{createdResume.owner}</dd></div>
                          <div><dt className="text-xs text-muted">Resume ID</dt><dd>{createdResume.resumeId.toString()}</dd></div>
                          <div><dt className="text-xs text-muted">Profile resume count</dt><dd>{profile.resumeCount.toString()}</dd></div>
                          <div><dt className="text-xs text-muted">Version</dt><dd>{createdResume.activeVersion.toString()} / {createdResume.versionCount.toString()}</dd></div>
                          <div><dt className="text-xs text-muted">Visibility</dt><dd>{createdResume.isPublic ? 'Công khai' : 'Riêng tư'}</dd></div>
                        </dl>
                      </div>
                    )}

                    {(resumeState === 'conflict' || resumeState === 'error') && (
                      <div className="mt-4 flex flex-col gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4" role="alert">
                        <p>{resumeError}</p>
                        <button type="button" onClick={() => void resetResumeAction()} className="w-fit rounded-lg border border-border-low px-4 py-2 text-sm font-medium hover:border-foreground/30">Tải lại trạng thái</button>
                      </div>
                    )}
                  </section>

                  {ownedResumes.length > 0 && (
                    <section className="border-t border-border-low pt-6" aria-labelledby="publish-version-title">
                      <h2 id="publish-version-title" className="text-xl font-semibold">Công bố phiên bản resume</h2>
                      <p className="mt-2 text-sm leading-6 text-muted">CV được lưu bằng Cloudinary public URL. Bất kỳ ai có URL đều có thể tải file; cờ resume riêng tư không phải cơ chế kiểm soát truy cập.</p>
                      <label className="mt-4 block text-sm font-medium">Resume</label>
                      <select
                        value={selectedResume?.address ?? ''}
                        onChange={(event) => {
                          setSelectedResume(ownedResumes.find((item) => item.address === event.target.value) ?? null)
                          setPreparedVersion(null); setPublishState('idle'); setPublishedVersion(null)
                        }}
                        disabled={['hashing', 'uploading', 'signing', 'verifying'].includes(publishState)}
                        className="mt-2 w-full rounded-lg border border-border-low bg-card px-3 py-2"
                      >
                        {ownedResumes.map((item) => <option key={item.address} value={item.address}>Resume #{item.resumeId.toString()} - version tiếp theo {item.versionCount.toString()}</option>)}
                      </select>
                      <div className="mt-4"><UploadZone name="resume-version" accept=".pdf,.docx" file={publishFile} onFileChange={handlePublishFileChange} hint="PDF hoặc DOCX, tối đa 10 MB" disabled={['hashing', 'uploading', 'signing', 'verifying'].includes(publishState)} /></div>
                      <label className="mt-4 flex items-start gap-3 text-sm">
                        <input type="checkbox" checked={publicAcknowledged} onChange={(event) => setPublicAcknowledged(event.target.checked)} disabled={['hashing', 'uploading', 'signing', 'verifying'].includes(publishState)} />
                        Tôi hiểu file và URI Cloudinary sẽ công khai, kể cả khi resume có trạng thái riêng tư.
                      </label>
                      {!preparedVersion && (
                        <button type="button" onClick={handlePrepareVersion} disabled={!publishFile || !selectedResume || !publicAcknowledged || ['hashing', 'uploading'].includes(publishState)} className="mt-4 rounded-lg bg-foreground px-4 py-2 font-medium text-background disabled:opacity-50">
                          {publishState === 'hashing' ? 'Đang tính hash...' : publishState === 'uploading' ? 'Đang upload...' : 'Chuẩn bị phiên bản'}
                        </button>
                      )}
                      {preparedVersion && (
                        <div className="mt-4 rounded-xl border border-border-low p-4">
                          <p className="font-semibold">Bản chuẩn bị version {preparedVersion.expectedVersion.toString()}</p>
                          <p className="mt-2 break-all text-xs">PDA: {preparedVersion.versionAddress}</p>
                          <p className="mt-1 break-all text-xs">URI: {preparedVersion.contentUri}</p>
                          <p className="mt-1 break-all font-mono text-xs">Content: {preparedVersion.contentHashHex}</p>
                          <p className="mt-1 break-all font-mono text-xs">Metadata: {preparedVersion.metadataHashHex}</p>
                          <p className="mt-1 text-xs">{preparedVersion.fileName} · {preparedVersion.mediaType} · {preparedVersion.size} bytes</p>
                          <button type="button" onClick={handlePublishVersion} disabled={publishState === 'signing' || publishState === 'verifying' || publishState === 'stale'} className="mt-4 rounded-lg bg-foreground px-4 py-2 font-medium text-background disabled:opacity-50">
                            {publishState === 'signing' ? 'Đang chờ ký...' : publishState === 'verifying' ? 'Đang xác minh...' : 'Ký và công bố'}
                          </button>
                        </div>
                      )}
                      {publishedVersion && publishState === 'success' && (
                        <div className="mt-4 rounded-xl border border-border-low p-4" role="status">
                          <p className="font-semibold">Phiên bản đã xác minh on-chain</p>
                          <p className="mt-2 break-all text-xs">Version PDA: {publishedVersion.address}</p>
                          <p className="break-all text-xs">Owner: {publishedVersion.owner}</p>
                          <p className="break-all text-xs">Resume: {publishedVersion.resume}</p>
                          <p className="break-all text-xs">URI: {publishedVersion.contentUri}</p>
                          <p className="break-all font-mono text-xs">Content: {bytesToHex(publishedVersion.contentHash)}</p>
                          <p className="break-all font-mono text-xs">Metadata: {bytesToHex(publishedVersion.metadataHash)}</p>
                          <p className="text-sm">Version {publishedVersion.version.toString()} · {publishedVersion.isRevoked ? 'Đã thu hồi' : 'Đang hoạt động'}</p>
                          <p className="text-sm">Active/version count: {selectedResume?.activeVersion.toString()} / {selectedResume?.versionCount.toString()}</p>
                          <p className="text-sm">Created: {publishedVersion.createdAt.toString()}</p>
                          <ResumePreview version={{ ...publishedVersion, fileName: preparedVersion?.fileName ?? 'resume', mediaType: preparedVersion?.mediaType ?? 'application/octet-stream', size: preparedVersion?.size ?? 0, verified: true } satisfies VerifiedResumeVersion} />
                        </div>
                      )}
                      {(publishState === 'error' || publishState === 'stale') && <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4" role="alert"><p>{publishError}</p><button type="button" onClick={() => setPublishState(preparedVersion ? 'prepared' : 'idle')} className="mt-3 rounded-lg border border-border-low px-3 py-2 text-sm">Thử lại</button></div>}
                    </section>
                  )}
                  <section className="border-t border-border-low pt-6" aria-labelledby="credential-list-title">
                    <h2 id="credential-list-title" className="text-xl font-semibold">Credential của profile</h2>
                    {assetState === 'loading' && <p className="mt-3 text-sm text-muted" role="status">Đang tải credential...</p>}
                    {assetState === 'error' && <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4" role="alert"><p>{assetError}</p><button type="button" onClick={() => void loadProfile()} className="mt-3 rounded-lg border border-border-low px-3 py-2 text-sm">Thử lại</button></div>}
                    {assetState === 'ready' && (credentials.length === 0 ? <p className="mt-3 text-sm text-muted">Chưa có credential hợp lệ.</p> : <div className="mt-4 grid gap-3">{credentials.map((credential) => <div key={credential.address} className="rounded-xl border border-border-low p-4"><p className="font-medium">Credential #{credential.credentialId.toString()} · {credential.status}</p><p className="mt-1 break-all font-mono text-xs text-muted">Issuer: {credential.issuer}</p><p className="mt-2 text-sm">{credential.subjectAccepted ? 'Đã được subject chấp nhận' : 'Chưa được subject chấp nhận'} · {credential.expiresAt === null ? 'Không hết hạn' : `Hết hạn: ${credential.expiresAt.toString()}`}</p><p className="mt-1 break-all text-xs text-muted">URI: {credential.credentialUri}</p><p className="mt-1 break-all font-mono text-xs text-muted">Type: {bytesToHex(credential.credentialTypeHash)}</p><p className="mt-1 break-all font-mono text-xs text-muted">Claims: {bytesToHex(credential.claimsHash)}</p>{credential.status === "Active" && !credential.subjectAccepted && connectedWallet?.signer && <button type="button" onClick={async () => { if (!connectedWallet) return; try { await acceptCredential(client, address(connectedWallet.account.address) as Address, credential.address, true); await loadProfile() } catch {} }} className="mt-2 rounded-lg bg-foreground px-3 py-1 text-xs font-medium text-background">Chấp nhận</button>}</div>)}</div>)}
                  </section>
                </div>
              )}
              {state === 'error' && (
                <div className="flex flex-col gap-3" role="alert">
                  <p>{error}</p>
                  <button type="button" onClick={() => void loadProfile()} className="w-fit rounded-lg border border-border-low px-4 py-2 text-sm font-medium hover:border-foreground/30">Thử lại</button>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
