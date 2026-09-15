'use client'

import { useState } from 'react'
import { UploadZone } from '@/components/upload-zone'
import { findJobMatches, type JobMatchResult } from '@/lib/jobMatchingApi'
import { useClient } from '@solana/react'
import { useConnectedWallet } from '@solana/kit-plugin-wallet/react'
import type { SolanaWalletClient } from '@/components/solana-provider'
import { createPaymentFetch } from '@/lib/x402Wallet'

export default function JobsPage() {
  const [cv, setCv] = useState<File | null>(null)
  const [location, setLocation] = useState('')
  const [workMode, setWorkMode] = useState('')
  const [targetRole, setTargetRole] = useState('')
  const [minimumMatchScore, setMinimumMatchScore] = useState('70')
  const [result, setResult] = useState<JobMatchResult | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const walletClient = useClient<SolanaWalletClient>()
  const connectedWallet = useConnectedWallet(walletClient)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!cv) { setError('Vui lòng chọn CV PDF hoặc DOCX.'); return }
    if (!connectedWallet?.signer) { setError('Vui lòng kết nối ví Solana để thanh toán tìm việc bằng AI.'); return }
    setError(''); setLoading(true); setResult(null)
    const data = new FormData()
    data.append('cv', cv)
    data.append('location', location)
    data.append('workMode', workMode)
    data.append('targetRole', targetRole)
    data.append('minimumMatchScore', minimumMatchScore)
    try { setResult(await findJobMatches(data, createPaymentFetch(connectedWallet.signer))) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể tìm việc phù hợp.') }
    finally { setLoading(false) }
  }

  return (
    <main className="min-h-screen bg-bg1 px-5 py-12 text-foreground sm:px-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10 max-w-3xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-muted">ResuMate AI job discovery</p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">CV của bạn. Công việc phù hợp nhất.</h1>
          <p className="mt-5 text-base leading-7 text-muted">Tải CV, thêm mong muốn nếu cần và nhận danh sách việc làm được AI đối chiếu theo kỹ năng thực tế.</p>
        </header>

        <form onSubmit={submit} className="grid gap-5 rounded-3xl border border-border-low bg-card p-5 shadow-[0_24px_70px_-45px_rgba(0,0,0,.5)] lg:grid-cols-[1.1fr_.9fr] lg:p-7">
          <UploadZone name="cv" accept=".pdf,.docx" file={cv} onFileChange={setCv} hint="PDF hoặc DOCX, tối đa 10MB" disabled={loading} />
          <div className="grid content-start gap-3">
            <input value={targetRole} onChange={e => setTargetRole(e.target.value)} placeholder="Vị trí mong muốn, ví dụ Backend Engineer" className="rounded-xl border border-border-low bg-card px-4 py-3 outline-none focus:border-foreground/40" />
            <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Địa điểm mong muốn" className="rounded-xl border border-border-low bg-card px-4 py-3 outline-none focus:border-foreground/40" />
            <select value={workMode} onChange={e => setWorkMode(e.target.value)} className="rounded-xl border border-border-low bg-card px-4 py-3 outline-none focus:border-foreground/40">
              <option value="">Mọi hình thức làm việc</option><option>Remote</option><option>Hybrid</option><option>On-site</option>
            </select>
            <label className="rounded-xl border border-border-low px-4 py-3 text-sm">Minimum suitability: <strong>{minimumMatchScore}%</strong><input type="range" min="0" max="100" step="5" value={minimumMatchScore} onChange={e => setMinimumMatchScore(e.target.value)} className="mt-3 w-full" /></label>
            <button disabled={loading} className="rounded-xl bg-foreground px-5 py-3 font-semibold text-background transition hover:opacity-85 disabled:opacity-50">{loading ? 'AI đang đối chiếu...' : 'Tìm việc phù hợp'}</button>
          </div>
        </form>

        {error && <p role="alert" className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm">{error}</p>}
        {result && <section className="mt-10">
          <div className="mb-6"><p className="text-xs font-semibold uppercase tracking-widest text-muted">Hồ sơ được nhận diện</p><p className="mt-2 max-w-3xl leading-7">{result.profileSummary}</p></div>
          {result.matches.length === 0 ? <div className="rounded-2xl border border-border-low bg-card p-6 text-muted">Chưa có kết quả. Hãy kiểm tra cấu hình Gemini hoặc thử lại.</div> :
            <div className="grid gap-4 lg:grid-cols-2">{result.matches.map(job => <article key={`${job.company}-${job.title}`} className="rounded-2xl border border-border-low bg-card p-6">
              <div className="flex items-start justify-between gap-5"><div><p className="text-sm text-muted">{job.company}</p><h2 className="mt-1 text-xl font-semibold">{job.title}</h2></div><span className="rounded-full bg-foreground px-3 py-1 text-sm font-bold text-background">{job.matchScore}%</span></div>
              <p className="mt-3 text-sm text-muted">{job.location} · {job.workMode} · {job.salary}</p><p className="mt-4 text-sm leading-6">{job.reason}</p>
              <div className="mt-4 flex flex-wrap gap-2">{job.matchedSkills.map(skill => <span key={skill} className="rounded-full bg-cream px-3 py-1 text-xs">{skill}</span>)}</div>
              {job.missingSkills.length > 0 && <p className="mt-4 text-xs text-muted">Cần bổ sung: {job.missingSkills.join(', ')}</p>}
              <a href={job.url} target="_blank" rel="noreferrer" className="mt-5 inline-block text-sm font-semibold underline underline-offset-4">Xem công việc</a>
            </article>)}</div>}
        </section>}
      </div>
    </main>
  )
}
