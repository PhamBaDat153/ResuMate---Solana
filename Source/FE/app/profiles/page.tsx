'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { address, type Address } from '@solana/kit'
import { useClient } from '@solana/react'
import type { SolanaWalletClient } from '@/components/solana-provider'
import { fetchAllProfiles, type UserProfile } from '@/lib/profileProgram'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

function shortAddress(value: string) { return `${value.slice(0, 6)}...${value.slice(-6)}` }

export default function ProfilesPage() {
  const client = useClient<SolanaWalletClient>()
  const [profiles, setProfiles] = useState<UserProfile[]>([])
  const [query, setQuery] = useState('')
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setState('loading')
    setError(null)
    try { setProfiles(await fetchAllProfiles(client)); setState('ready') }
    catch (cause) { setState('error'); setError(cause instanceof Error ? cause.message : 'Không thể tải danh sách profile.') }
  }, [client])
  useEffect(() => {
    const refresh = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(refresh)
  }, [load])

  const normalized = query.trim()
  let visible = profiles
  let invalidQuery = false
  if (normalized) {
    try {
      const target = address(normalized) as Address
      visible = profiles.filter((profile) => profile.owner === target)
    } catch { visible = []; invalidQuery = true }
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader eyebrow="ResuMate · On-chain directory" title="Profile công khai" description="Khám phá các profile và tài sản nghề nghiệp đã được công khai trên Solana." />
      <Card className="mb-6 border-border/70 bg-card/80 shadow-panel">
        <CardHeader><CardTitle className="font-display text-lg">Tìm theo địa chỉ ví</CardTitle><CardDescription>Nhập đầy đủ địa chỉ wallet để mở đúng profile.</CardDescription></CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Địa chỉ ví Solana" className="font-mono text-xs" />
          {normalized && !invalidQuery && visible.length === 1 && <Button asChild><Link href={`/profiles/${visible[0].owner}`}>Mở profile</Link></Button>}
        </CardContent>
      </Card>
      {state === 'loading' && <p role="status" className="text-muted-foreground">Đang tải profile on-chain...</p>}
      {state === 'error' && <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4" role="alert"><p>{error}</p><Button variant="outline" className="mt-3" onClick={() => void load()}>Thử lại</Button></div>}
      {state === 'ready' && visible.length === 0 && <p className="text-muted-foreground">{invalidQuery ? 'Địa chỉ ví không hợp lệ.' : normalized ? 'Không tìm thấy profile.' : 'Chưa có profile công khai.'}</p>}
      {state === 'ready' && visible.length > 0 && <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{visible.map((profile) => <Card key={profile.address} className="border-border/70 bg-card/80"><CardHeader><CardTitle className="font-mono text-sm">{shortAddress(profile.owner)}</CardTitle><CardDescription className="break-all font-mono text-[11px]">{profile.owner}</CardDescription></CardHeader><CardContent><dl className="grid grid-cols-2 gap-3 text-sm"><div><dt className="text-muted-foreground">Resumes</dt><dd className="font-semibold">{profile.resumeCount.toString()}</dd></div><div><dt className="text-muted-foreground">Credentials</dt><dd className="font-semibold">{profile.credentialCount.toString()}</dd></div></dl><Button asChild variant="outline" className="mt-4 w-full"><Link href={`/profiles/${profile.owner}`}>Xem profile</Link></Button></CardContent></Card>)}</div>}
    </div>
  )
}
