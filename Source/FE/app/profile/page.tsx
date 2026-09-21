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
import { toast } from 'sonner'
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
import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

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
      toast.success('Hồ sơ đã được tạo on-chain')
    } catch (createError) {
      setState('error')
      const message = getProfileError(createError)
      setError(message)
      toast.error('Không thể tạo hồ sơ', { description: message })
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
      toast.success('Resume đã được xác minh on-chain')
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
      toast.error('Không thể tạo resume', { description: mappedError.message })
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
      toast.message('Phiên bản đã sẵn sàng để ký')
    } catch (prepareError) {
      setPublishState('error')
      const message = getPublishError(prepareError)
      setPublishError(message)
      toast.error('Chuẩn bị phiên bản thất bại', { description: message })
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
      toast.success('Phiên bản CV đã được công bố on-chain')
    } catch (publishFailure) {
      const message = getPublishError(publishFailure)
      setPublishState(message.includes('stale') || message.includes('thay đổi') ? 'stale' : 'error')
      setPublishError(message)
      toast.error('Công bố thất bại', { description: message })
    }
  }

  const publishing = ['hashing', 'uploading', 'signing', 'verifying'].includes(publishState)

  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageHeader
        eyebrow="ResuMate · Hồ sơ cá nhân"
        title="Hồ sơ của tôi"
        description="Tạo hồ sơ để bắt đầu quản lý CV và chứng nhận. Hồ sơ chỉ lưu định danh ví và các bộ đếm, không lưu thông tin cá nhân."
      />

      <Card className="border-border/70 bg-card/80 shadow-panel animate-fade-up">
        <CardContent className="p-6 sm:p-8">
          {!connectedWallet ? (
            <div className="flex flex-col gap-4">
              <p className="text-muted-foreground">Kết nối ví Solana để kiểm tra hoặc tạo profile.</p>
              {wallets.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {wallets.map((wallet) => (
                    <Button
                      key={wallet.name}
                      type="button"
                      onClick={() => connect.dispatch(wallet)}
                      disabled={connect.isRunning}
                    >
                      {connect.isRunning ? 'Đang kết nối...' : `Kết nối ${wallet.name}`}
                    </Button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Không tìm thấy ví tương thích Wallet Standard.</p>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-8">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">Chủ hồ sơ</p>
                  <p className="mt-1 break-all font-mono text-xs text-foreground/90">{connectedWallet.account.address}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => disconnect.dispatch()}
                  disabled={state === 'creating' || disconnect.isRunning}
                >
                  Ngắt kết nối
                </Button>
              </div>

              {state === 'loading' && (
                <p className="text-muted-foreground" role="status">Đang kiểm tra hồ sơ trên Solana...</p>
              )}

              {state === 'missing' && (
                <div className="flex flex-col gap-4 rounded-xl border border-primary/25 bg-signal-soft/40 p-5">
                  <div>
                    <p className="font-display text-lg font-semibold">Ví này chưa có hồ sơ.</p>
                    <p className="mt-1 text-sm text-muted-foreground">Một giao dịch ký sẽ khởi tạo PDA profile của bạn.</p>
                  </div>
                  <Button type="button" onClick={handleCreate} disabled={!connectedWallet.signer} className="w-fit">
                    Tạo hồ sơ
                  </Button>
                  {profileAddress && (
                    <p className="break-all font-mono text-xs text-muted-foreground">Profile PDA: {profileAddress}</p>
                  )}
                </div>
              )}

              {state === 'creating' && (
                <p className="text-muted-foreground" role="status">Đang chờ ví ký và xác nhận giao dịch...</p>
              )}

              {state === 'existing' && profile && (
                <div className="flex flex-col gap-8">
                  <dl className="grid gap-4 sm:grid-cols-2">
                    <MetaCell label="Profile PDA" value={profile.address} mono />
                    <MetaCell label="Owner" value={profile.owner} mono />
                    <MetaCell label="Resume count" value={profile.resumeCount.toString()} large />
                    <MetaCell label="Credential count" value={profile.credentialCount.toString()} large />
                  </dl>

                  <section className="border-t border-border pt-6" aria-labelledby="create-resume-title">
                    <h2 id="create-resume-title" className="font-display text-xl font-semibold">Tạo CV</h2>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Bước này chỉ tạo container resume riêng tư trên Solana. Nội dung CV, hash và URI chỉ được thêm ở bước công bố phiên bản riêng biệt.
                    </p>

                    {(resumeState === 'loading' || resumeState === 'creating' || resumeState === 'refreshing') && (
                      <p className="mt-4 text-sm text-muted-foreground" role="status">
                        {resumeState === 'loading'
                          ? 'Đang xác định Resume PDA tiếp theo...'
                          : resumeState === 'creating'
                            ? 'Đang chờ ví ký và xác nhận giao dịch tạo resume...'
                            : 'Giao dịch đã gửi, đang xác minh profile và Resume PDA...'}
                      </p>
                    )}

                    {(resumeState === 'ready' || resumeState === 'success') && nextResumeAddress && (
                      <div className="mt-4 rounded-xl border border-border bg-secondary/40 p-4">
                        <p className="text-sm text-muted-foreground">Resume tiếp theo</p>
                        <p className="mt-1 font-semibold">ID {profile.resumeCount.toString()}</p>
                        <p className="mt-2 break-all font-mono text-xs text-muted-foreground">PDA: {nextResumeAddress}</p>
                        <Button
                          type="button"
                          onClick={handleCreateResume}
                          disabled={resumeState !== 'ready' || !connectedWallet.signer}
                          className="mt-4"
                        >
                          Tạo resume
                        </Button>
                      </div>
                    )}

                    {resumeState === 'success' && createdResume && (
                      <div className="mt-4 rounded-xl border border-primary/30 bg-signal-soft/30 p-4" role="status">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold">Resume đã được xác minh on-chain</p>
                          <Badge className="bg-primary/20 text-primary hover:bg-primary/20">On-chain</Badge>
                        </div>
                        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                          <MetaCell label="Resume PDA" value={createdResume.address} mono compact />
                          <MetaCell label="Owner" value={createdResume.owner} mono compact />
                          <MetaCell label="Resume ID" value={createdResume.resumeId.toString()} compact />
                          <MetaCell label="Profile resume count" value={profile.resumeCount.toString()} compact />
                          <MetaCell
                            label="Version"
                            value={`${createdResume.activeVersion.toString()} / ${createdResume.versionCount.toString()}`}
                            compact
                          />
                          <MetaCell
                            label="Visibility"
                            value={createdResume.isPublic ? 'Công khai' : 'Riêng tư'}
                            compact
                          />
                        </dl>
                      </div>
                    )}

                    {(resumeState === 'conflict' || resumeState === 'error') && (
                      <div className="mt-4 flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4" role="alert">
                        <p>{resumeError}</p>
                        <Button type="button" variant="outline" className="w-fit" onClick={() => void resetResumeAction()}>
                          Tải lại trạng thái
                        </Button>
                      </div>
                    )}
                  </section>

                  {ownedResumes.length > 0 && (
                    <section className="border-t border-border pt-6" aria-labelledby="publish-version-title">
                      <h2 id="publish-version-title" className="font-display text-xl font-semibold">Cập nhật phiên bản CV</h2>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        CV được lưu bằng Cloudinary public URL. Bất kỳ ai có URL đều có thể tải file; cờ resume riêng tư không phải cơ chế kiểm soát truy cập.
                      </p>

                      <label className="mt-4 block text-sm font-medium">CV</label>
                      <select
                        value={selectedResume?.address ?? ''}
                        onChange={(event) => {
                          setSelectedResume(ownedResumes.find((item) => item.address === event.target.value) ?? null)
                          setPreparedVersion(null)
                          setPublishState('idle')
                          setPublishedVersion(null)
                        }}
                        disabled={publishing}
                        className="mt-2 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        {ownedResumes.map((item) => (
                          <option key={item.address} value={item.address}>
                            Resume #{item.resumeId.toString()} - version tiếp theo {item.versionCount.toString()}
                          </option>
                        ))}
                      </select>

                      <div className="mt-4">
                        <UploadZone
                          name="resume-version"
                          accept=".pdf,.docx"
                          file={publishFile}
                          onFileChange={handlePublishFileChange}
                          hint="PDF hoặc DOCX, tối đa 10 MB"
                          disabled={publishing}
                        />
                      </div>

                      <label className="mt-4 flex items-start gap-3 text-sm text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={publicAcknowledged}
                          onChange={(event) => setPublicAcknowledged(event.target.checked)}
                          disabled={publishing}
                          className="mt-1"
                        />
                        Tôi hiểu file và URI Cloudinary sẽ công khai, kể cả khi resume có trạng thái riêng tư.
                      </label>

                      {!preparedVersion && (
                        <Button
                          type="button"
                          onClick={handlePrepareVersion}
                          disabled={!publishFile || !selectedResume || !publicAcknowledged || ['hashing', 'uploading'].includes(publishState)}
                          className="mt-4"
                        >
                          {publishState === 'hashing'
                            ? 'Đang tính hash...'
                            : publishState === 'uploading'
                              ? 'Đang upload...'
                              : 'Chuẩn bị phiên bản'}
                        </Button>
                      )}

                      {preparedVersion && (
                        <div className="mt-4 rounded-xl border border-border bg-secondary/30 p-4">
                          <p className="font-semibold">Bản chuẩn bị version {preparedVersion.expectedVersion.toString()}</p>
                          <p className="mt-2 break-all font-mono text-xs text-muted-foreground">PDA: {preparedVersion.versionAddress}</p>
                          <p className="mt-1 break-all text-xs text-muted-foreground">URI: {preparedVersion.contentUri}</p>
                          <p className="mt-1 break-all font-mono text-xs">Content: {preparedVersion.contentHashHex}</p>
                          <p className="mt-1 break-all font-mono text-xs">Metadata: {preparedVersion.metadataHashHex}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {preparedVersion.fileName} · {preparedVersion.mediaType} · {preparedVersion.size} bytes
                          </p>
                          <Button
                            type="button"
                            onClick={handlePublishVersion}
                            disabled={publishState === 'signing' || publishState === 'verifying' || publishState === 'stale'}
                            className="mt-4"
                          >
                            {publishState === 'signing'
                              ? 'Đang chờ ký...'
                              : publishState === 'verifying'
                                ? 'Đang xác minh...'
                                : 'Ký và công bố'}
                          </Button>
                        </div>
                      )}

                      {publishedVersion && publishState === 'success' && (
                        <div className="mt-4 rounded-xl border border-primary/30 bg-signal-soft/30 p-4" role="status">
                          <p className="font-semibold">Phiên bản đã xác minh on-chain</p>
                          <p className="mt-2 break-all text-xs">Version PDA: {publishedVersion.address}</p>
                          <p className="break-all text-xs">Owner: {publishedVersion.owner}</p>
                          <p className="break-all text-xs">Resume: {publishedVersion.resume}</p>
                          <p className="break-all text-xs">URI: {publishedVersion.contentUri}</p>
                          <p className="break-all font-mono text-xs">Content: {bytesToHex(publishedVersion.contentHash)}</p>
                          <p className="break-all font-mono text-xs">Metadata: {bytesToHex(publishedVersion.metadataHash)}</p>
                          <p className="text-sm">
                            Version {publishedVersion.version.toString()} ·{' '}
                            {publishedVersion.isRevoked ? 'Đã thu hồi' : 'Đang hoạt động'}
                          </p>
                          <p className="text-sm">
                            Active/version count: {selectedResume?.activeVersion.toString()} /{' '}
                            {selectedResume?.versionCount.toString()}
                          </p>
                          <p className="text-sm">Created: {publishedVersion.createdAt.toString()}</p>
                          <ResumePreview
                            version={
                              {
                                ...publishedVersion,
                                fileName: preparedVersion?.fileName ?? 'resume',
                                mediaType: preparedVersion?.mediaType ?? 'application/octet-stream',
                                size: preparedVersion?.size ?? 0,
                                verified: true,
                              } satisfies VerifiedResumeVersion
                            }
                          />
                        </div>
                      )}

                      {(publishState === 'error' || publishState === 'stale') && (
                        <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-4" role="alert">
                          <p>{publishError}</p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mt-3"
                            onClick={() => setPublishState(preparedVersion ? 'prepared' : 'idle')}
                          >
                            Thử lại
                          </Button>
                        </div>
                      )}
                    </section>
                  )}

                  <section className="border-t border-border pt-6" aria-labelledby="credential-list-title">
                    <h2 id="credential-list-title" className="font-display text-xl font-semibold">Chứng nhận của tôi</h2>
                    {assetState === 'loading' && (
                      <p className="mt-3 text-sm text-muted-foreground" role="status">Đang tải chứng nhận...</p>
                    )}
                    {assetState === 'error' && (
                      <div className="mt-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4" role="alert">
                        <p>{assetError}</p>
                        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => void loadProfile()}>
                          Thử lại
                        </Button>
                      </div>
                    )}
                    {assetState === 'ready' &&
                      (credentials.length === 0 ? (
                        <p className="mt-3 text-sm text-muted-foreground">Chưa có chứng nhận hợp lệ.</p>
                      ) : (
                        <div className="mt-4 grid gap-3">
                          {credentials.map((credential) => (
                            <Card key={credential.address} className="border-border/80 bg-secondary/20">
                              <CardHeader className="pb-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <CardTitle className="text-base">
                                    Chứng nhận #{credential.credentialId.toString()}
                                  </CardTitle>
                                  <Badge variant={credential.status === 'Active' ? 'default' : 'secondary'}>
                                    {credential.status === 'Active' ? 'Đang hoạt động' : 'Đã thu hồi'}
                                  </Badge>
                                </div>
                                <CardDescription className="break-all font-mono text-xs">
                                  Đơn vị cấp: {credential.issuer}
                                </CardDescription>
                              </CardHeader>
                              <CardContent className="space-y-1 text-sm">
                                <div className="rounded-lg border border-border-low bg-card/60 p-3">
                                  <p className="text-xs font-medium text-muted-foreground">Mã chứng nhận dùng để Verify</p>
                                  <div className="mt-1 flex items-start gap-2">
                                    <p className="min-w-0 flex-1 break-all font-mono text-xs">{credential.address}</p>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="shrink-0"
                                      onClick={() => {
                                        void navigator.clipboard.writeText(credential.address)
                                        toast.success('Đã sao chép mã chứng nhận')
                                      }}
                                    >
                                      Copy
                                    </Button>
                                  </div>
                                </div>
                                <p>
                                  {credential.subjectAccepted
                                    ? 'Đã được người nhận xác nhận'
                                    : 'Chưa được người nhận xác nhận'}{' '}
                                  ·{' '}
                                  {credential.expiresAt === null
                                    ? 'Không hết hạn'
                                    : `Hết hạn: ${credential.expiresAt.toString()}`}
                                </p>
                                <p className="break-all text-xs text-muted-foreground">URI: {credential.credentialUri}</p>
                                <p className="break-all font-mono text-xs text-muted-foreground">
                                  Loại: {bytesToHex(credential.credentialTypeHash)}
                                </p>
                                <p className="break-all font-mono text-xs text-muted-foreground">
                                  Claims: {bytesToHex(credential.claimsHash)}
                                </p>
                                {credential.status === 'Active' &&
                                  !credential.subjectAccepted &&
                                  connectedWallet?.signer && (
                                    <Button
                                      type="button"
                                      size="sm"
                                      className="mt-2"
                                      onClick={async () => {
                                        if (!connectedWallet) return
                                        try {
                                          await acceptCredential(
                                            client,
                                            address(connectedWallet.account.address) as Address,
                                            credential.address,
                                            true,
                                          )
                                          await loadProfile()
                                          toast.success('Đã xác nhận chứng nhận')
                                        } catch (acceptError) {
                                          toast.error('Không thể xác nhận', {
                                            description:
                                              acceptError instanceof Error
                                                ? acceptError.message
                                                : 'Giao dịch thất bại',
                                          })
                                        }
                                      }}
                                    >
                                      Xác nhận
                                    </Button>
                                  )}
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      ))}
                  </section>
                </div>
              )}

              {state === 'error' && (
                <div className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4" role="alert">
                  <p>{error}</p>
                  <Button type="button" variant="outline" className="w-fit" onClick={() => void loadProfile()}>
                    Thử lại
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function MetaCell({
  label,
  value,
  mono,
  large,
  compact,
}: {
  label: string
  value: string
  mono?: boolean
  large?: boolean
  compact?: boolean
}) {
  return (
    <div>
      <dt className={cn(compact ? 'text-xs' : 'text-sm', 'text-muted-foreground')}>{label}</dt>
      <dd
        className={cn(
          'mt-1',
          large && 'text-xl font-semibold',
          mono && 'break-all font-mono text-xs',
          !mono && !large && 'text-sm',
        )}
      >
        {value}
      </dd>
    </div>
  )
}
