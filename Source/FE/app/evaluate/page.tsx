'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useClient } from '@solana/react'
import {
  useConnect,
  useConnectedWallet,
  useDisconnect,
  useWallets,
} from '@solana/kit-plugin-wallet/react'
import { toast } from 'sonner'
import { UploadZone } from '@/components/upload-zone'
import { submitEvaluation } from '@/lib/evaluationApi'
import type { SolanaWalletClient } from '@/components/solana-provider'
import { createPaymentFetch } from '@/lib/x402Wallet'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type JdMode = 'text' | 'file'

export default function EvaluatePage() {
  const router = useRouter()
  const walletClient = useClient<SolanaWalletClient>()
  const wallets = useWallets(walletClient)
  const connectedWallet = useConnectedWallet(walletClient)
  const connect = useConnect(walletClient)
  const disconnect = useDisconnect(walletClient)
  const [cvFile, setCvFile] = useState<File | null>(null)
  const [jdMode, setJdMode] = useState<JdMode>('text')
  const [jdText, setJdText] = useState('')
  const [jdFile, setJdFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (!cvFile) {
      setError('Vui lòng chọn file CV của bạn.')
      return
    }

    const hasJd = jdMode === 'text' ? jdText.trim().length > 0 : jdFile !== null
    if (!hasJd) {
      setError('Vui lòng cung cấp mô tả công việc (dán văn bản hoặc tải file).')
      return
    }

    if (!connectedWallet?.signer) {
      setError('Vui lòng kết nối ví Solana có thể ký giao dịch trước khi đánh giá.')
      toast.error('Cần kết nối ví')
      return
    }

    const formData = new FormData()
    formData.append('cv', cvFile)
    if (jdMode === 'text') {
      formData.append('jobDescription', jdText.trim())
    } else if (jdFile) {
      formData.append('jobDescriptionFile', jdFile)
    }

    setIsSubmitting(true)
    toast.message('Đang đánh giá CV…')
    try {
      const evaluation = await submitEvaluation(
        formData,
        createPaymentFetch(connectedWallet.signer),
      )
      const encoded = encodeURIComponent(JSON.stringify(evaluation))
      toast.success('Đánh giá hoàn tất')
      router.push(`/result?data=${encoded}`)
    } catch (submissionError) {
      const message =
        submissionError instanceof Error
          ? submissionError.message
          : 'Không thể đánh giá CV. Vui lòng thử lại.'
      setError(message)
      toast.error('Đánh giá thất bại', { description: message })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageHeader
        eyebrow="ResuMate · AI evaluation"
        title="Đánh giá CV"
        description="Tải CV và cung cấp mô tả công việc để nhận đánh giá phù hợp."
      />

      <Card className="mb-6 border-border/70 bg-card/80 shadow-panel animate-fade-up">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
          {connectedWallet ? (
            <>
              <p className="text-muted-foreground">
                Ví đã kết nối:{' '}
                <span className="break-all font-mono text-xs text-foreground">
                  {connectedWallet.account.address}
                </span>
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => disconnect.dispatch()}
                disabled={isSubmitting || disconnect.isRunning}
              >
                Ngắt kết nối
              </Button>
            </>
          ) : wallets.length > 0 ? (
            <>
              <p className="text-muted-foreground">Kết nối ví Solana để thanh toán đánh giá.</p>
              <div className="flex flex-wrap gap-2">
                {wallets.map((wallet) => (
                  <Button
                    key={wallet.name}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => connect.dispatch(wallet)}
                    disabled={isSubmitting || connect.isRunning}
                  >
                    Kết nối {wallet.name}
                  </Button>
                ))}
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">
              Không tìm thấy ví Solana tương thích. Hãy cài ví hỗ trợ Wallet Standard và chọn đúng mạng.
            </p>
          )}
        </CardContent>
      </Card>

      {error && (
        <div
          className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm"
          role="alert"
        >
          {error}
        </div>
      )}

      {isSubmitting && (
        <div
          className="mb-6 rounded-lg border border-border bg-signal-soft/40 px-4 py-3 text-center text-sm text-muted-foreground"
          role="status"
        >
          Đang phân tích CV, vui lòng chờ trong giây lát...
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="border-border/70 bg-card/80 shadow-panel animate-fade-up">
            <CardHeader>
              <CardTitle className="font-display text-base">CV của bạn</CardTitle>
            </CardHeader>
            <CardContent>
              <UploadZone
                name="cv"
                accept=".pdf,.docx"
                file={cvFile}
                onFileChange={setCvFile}
                hint="PDF, DOCX"
                disabled={isSubmitting}
              />
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/80 shadow-panel animate-fade-up" style={{ animationDelay: '60ms' }}>
            <CardHeader>
              <CardTitle className="font-display text-base">Mô tả công việc (JD)</CardTitle>
              <CardDescription>Dán văn bản hoặc tải file JD.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 inline-flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={jdMode === 'text' ? 'default' : 'outline'}
                  onClick={() => setJdMode('text')}
                  disabled={isSubmitting}
                >
                  Dán văn bản
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={jdMode === 'file' ? 'default' : 'outline'}
                  onClick={() => setJdMode('file')}
                  disabled={isSubmitting}
                >
                  Tải file
                </Button>
              </div>

              {jdMode === 'text' ? (
                <textarea
                  className={cn(
                    'w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm',
                    'outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring',
                    'disabled:cursor-not-allowed disabled:opacity-60',
                  )}
                  rows={10}
                  placeholder="Dán mô tả công việc vào đây..."
                  value={jdText}
                  onChange={(event) => setJdText(event.target.value)}
                  disabled={isSubmitting}
                />
              ) : (
                <UploadZone
                  name="jobDescriptionFile"
                  accept=".pdf,.docx"
                  file={jdFile}
                  onFileChange={setJdFile}
                  hint="PDF, DOCX"
                  disabled={isSubmitting}
                />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="mt-6 flex justify-center">
          <Button type="submit" size="lg" disabled={isSubmitting} className="min-w-48">
            {isSubmitting ? 'Đang đánh giá...' : 'Đánh giá'}
          </Button>
        </div>
      </form>

      {connectedWallet && (
        <div className="mt-4 flex justify-center">
          <Badge variant="outline" className="font-mono text-[10px]">
            x402 payment ready
          </Badge>
        </div>
      )}
    </div>
  )
}
