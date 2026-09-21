'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { UploadZone } from '@/components/upload-zone'
import { findJobMatches, type JobMatchResult } from '@/lib/jobMatchingApi'
import { useClient } from '@solana/react'
import { useConnectedWallet } from '@solana/kit-plugin-wallet/react'
import type { SolanaWalletClient } from '@/components/solana-provider'
import { createPaymentFetch } from '@/lib/x402Wallet'
import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const SEARCH_STEPS = [
  'Đọc nội dung CV của bạn',
  'Tìm việc từ các nguồn công khai',
  'Loại bỏ tin trùng lặp',
  'AI đối chiếu CV với yêu cầu công việc',
  'Lọc theo mức độ phù hợp tối thiểu',
]

const fieldClass =
  'flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export default function JobsPage() {
  const [cv, setCv] = useState<File | null>(null)
  const [location, setLocation] = useState('')
  const [workMode, setWorkMode] = useState('')
  const [targetRole, setTargetRole] = useState('')
  const [minimumMatchScore, setMinimumMatchScore] = useState('70')
  const [result, setResult] = useState<JobMatchResult | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeStep, setActiveStep] = useState(-1)
  const walletClient = useClient<SolanaWalletClient>()
  const connectedWallet = useConnectedWallet(walletClient)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!cv) {
      setError('Vui lòng chọn CV PDF hoặc DOCX.')
      toast.error('Thiếu CV')
      return
    }
    if (!connectedWallet?.signer) {
      setError('Vui lòng kết nối ví Solana để thanh toán tìm việc bằng AI.')
      toast.error('Cần kết nối ví')
      return
    }
    setError('')
    setLoading(true)
    setResult(null)
    setActiveStep(0)
    const data = new FormData()
    data.append('cv', cv)
    data.append('location', location)
    data.append('workMode', workMode)
    data.append('targetRole', targetRole)
    data.append('minimumMatchScore', minimumMatchScore)
    const progressTimer = window.setInterval(() => {
      setActiveStep((step) => Math.min(step + 1, SEARCH_STEPS.length - 1))
    }, 1800)
    try {
      const matches = await findJobMatches(data, createPaymentFetch(connectedWallet.signer))
      setActiveStep(SEARCH_STEPS.length)
      setResult(matches)
      toast.success('Đã tìm xong việc phù hợp', {
        description: `${matches.matches.length} kết quả`,
      })
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Không thể tìm việc phù hợp.'
      setError(message)
      toast.error('Tìm việc thất bại', { description: message })
    } finally {
      window.clearInterval(progressTimer)
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader
        eyebrow="ResuMate · AI job discovery"
        title="CV của bạn. Công việc phù hợp nhất."
        description="Tải CV, thêm mong muốn nếu cần và nhận danh sách việc làm được AI đối chiếu theo kỹ năng thực tế."
      />

      <form onSubmit={submit}>
        <Card className="border-border/70 bg-card/80 shadow-panel animate-fade-up">
          <CardContent className="grid gap-5 p-5 lg:grid-cols-[1.1fr_0.9fr] lg:p-7">
            <UploadZone
              name="cv"
              accept=".pdf,.docx"
              file={cv}
              onFileChange={setCv}
              hint="PDF hoặc DOCX, tối đa 10MB"
              disabled={loading}
            />
            <div className="grid content-start gap-3">
              <Input
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                placeholder="Vị trí mong muốn, ví dụ Backend Engineer"
                disabled={loading}
              />
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Địa điểm mong muốn"
                disabled={loading}
              />
              <select
                value={workMode}
                onChange={(e) => setWorkMode(e.target.value)}
                disabled={loading}
                className={fieldClass}
              >
                <option value="">Mọi hình thức làm việc</option>
                <option>Remote</option>
                <option>Hybrid</option>
                <option>On-site</option>
              </select>
              <div className="rounded-md border border-border px-4 py-3 text-sm">
                Minimum suitability: <strong>{minimumMatchScore}%</strong>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={minimumMatchScore}
                  onChange={(e) => setMinimumMatchScore(e.target.value)}
                  className="mt-3 w-full accent-[hsl(var(--primary))]"
                  disabled={loading}
                />
              </div>
              <Button type="submit" size="lg" disabled={loading} className="w-full">
                {loading ? 'AI đang đối chiếu...' : 'Tìm việc phù hợp'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      {loading && (
        <Card className="mt-5 border-border/70 bg-card/80 shadow-panel" role="status" aria-live="polite">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base">Đang tìm việc phù hợp...</CardTitle>
                <CardDescription>Quy trình AI đang được thực hiện</CardDescription>
              </div>
              <Badge variant="outline">
                {Math.min(activeStep + 1, SEARCH_STEPS.length)}/{SEARCH_STEPS.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ol className="grid gap-2 sm:grid-cols-5">
              {SEARCH_STEPS.map((step, index) => {
                const completed = index < activeStep
                const current = index === activeStep
                return (
                  <li
                    key={step}
                    className={cn(
                      'rounded-lg border px-3 py-3 text-xs transition-colors',
                      completed && 'border-primary/30 bg-signal-soft text-foreground',
                      current && 'border-primary bg-primary text-primary-foreground',
                      !completed && !current && 'border-border text-muted-foreground',
                    )}
                  >
                    <span className="mr-2 font-bold">{completed ? '✓' : index + 1}</span>
                    {step}
                  </li>
                )
              })}
            </ol>
          </CardContent>
        </Card>
      )}

      {error && (
        <p role="alert" className="mt-5 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm">
          {error}
        </p>
      )}

      {result && (
        <section className="mt-10 animate-fade-up">
          <div className="mb-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
              Hồ sơ được nhận diện
            </p>
            <p className="mt-2 max-w-3xl leading-7 text-muted-foreground">{result.profileSummary}</p>
          </div>
          {result.matches.length === 0 ? (
            <Card className="border-border/70 bg-card/80 p-6 text-muted-foreground">{result.profileSummary}</Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {result.matches.map((job) => (
                <Card key={`${job.company}-${job.title}`} className="border-border/70 bg-card/80 shadow-panel">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-5">
                      <div>
                        <CardDescription>{job.company}</CardDescription>
                        <CardTitle className="mt-1 font-display text-xl">{job.title}</CardTitle>
                      </div>
                      <Badge className="bg-primary/20 text-primary hover:bg-primary/20">{job.matchScore}%</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {job.location} · {job.workMode} · {job.salary}
                    </p>
                    <p className="mt-4 text-sm leading-6">{job.reason}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {job.matchedSkills.map((skill) => (
                        <Badge key={skill} variant="secondary" className="font-normal">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                    {job.missingSkills.length > 0 && (
                      <p className="mt-4 text-xs text-muted-foreground">
                        Cần bổ sung: {job.missingSkills.join(', ')}
                      </p>
                    )}
                    <Button asChild variant="link" className="mt-4 h-auto px-0">
                      <a href={job.url} target="_blank" rel="noreferrer">
                        Xem công việc
                      </a>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
