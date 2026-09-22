'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { address, type Address } from '@solana/kit'
import { useClient } from '@solana/react'
import type { SolanaWalletClient } from '@/components/solana-provider'
import { fetchPublicProfile } from '@/lib/profileProgram'
import { fetchPublicActiveResumeVersion } from '@/lib/resumeVersionProgram'
import type { CredentialAccount } from '@/lib/credentialProgram'
import { PublicCredentialView } from '@/components/public-credential-view'
import { PublicResumeView } from '@/components/public-resume-view'
import { PageHeader } from '@/components/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function PublicProfilePage({ params }: { params: Promise<{ wallet: string }> }) {
  const client = useClient<SolanaWalletClient>()
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchPublicProfile>>>(null)
  const [publicVersions, setPublicVersions] = useState<Array<{ resumeId: string; version: Awaited<ReturnType<typeof fetchPublicActiveResumeVersion>> }>>([])
  const [state, setState] = useState<'loading' | 'ready' | 'not-found' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const { wallet } = await params
        const owner = address(wallet) as Address
        const next = await fetchPublicProfile(client, owner)
        if (cancelled) return
        if (!next) { setState('not-found'); return }
        setData(next)
        const versions = await Promise.all(next.resumes.map(async (resume) => ({ resumeId: resume.resumeId.toString(), version: await fetchPublicActiveResumeVersion(client, resume) })))
        if (!cancelled) { setPublicVersions(versions.filter((item) => item.version)); setState('ready') }
      } catch (cause) { if (!cancelled) { setState('error'); setError(cause instanceof Error ? cause.message : 'Không thể tải profile.') } }
    }
    void load()
    return () => { cancelled = true }
  }, [client, params])

  if (state === 'loading') return <p role="status" className="text-muted-foreground">Đang tải profile on-chain...</p>
  if (state === 'not-found') return <Card><CardHeader><CardTitle>Không tìm thấy profile</CardTitle></CardHeader><CardContent><Button asChild><Link href="/profiles">Quay lại directory</Link></Button></CardContent></Card>
  if (state === 'error') return <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4" role="alert">{error}</div>
  if (!data) return null

  return <div className="mx-auto w-full max-w-5xl"><PageHeader eyebrow="ResuMate · Public profile" title="Profile on-chain" description="Chỉ hiển thị resume public và credential được xác minh khi bạn yêu cầu xem." /><p className="mb-6 break-all font-mono text-xs text-muted-foreground">Wallet: {data.profile.owner}</p><div className="space-y-6"><Card><CardHeader><CardTitle className="font-display text-xl">Resume public</CardTitle></CardHeader><CardContent className="space-y-4">{publicVersions.length === 0 ? <p className="text-sm text-muted-foreground">Profile chưa có resume public khả dụng.</p> : publicVersions.map(({ resumeId, version }) => version && <div key={version.address}><p className="mb-2 text-sm text-muted-foreground">Resume #{resumeId}</p><PublicResumeView version={version} /></div>)}</CardContent></Card><Card><CardHeader><CardTitle className="font-display text-xl">Credential</CardTitle></CardHeader><CardContent className="space-y-4">{data.credentials.length === 0 ? <p className="text-sm text-muted-foreground">Profile chưa có credential.</p> : data.credentials.map((credential: CredentialAccount) => <PublicCredentialView key={credential.address} client={client} credential={credential} />)}</CardContent></Card></div></div>
}
