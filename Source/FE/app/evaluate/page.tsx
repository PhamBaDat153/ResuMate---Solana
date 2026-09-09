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
import { UploadZone } from '@/components/upload-zone'
import { submitEvaluation } from '@/lib/evaluationApi'
import type { SolanaWalletClient } from '@/components/solana-provider'
import { createPaymentFetch } from '@/lib/x402Wallet'

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

    const hasJd =
      jdMode === 'text' ? jdText.trim().length > 0 : jdFile !== null
    if (!hasJd) {
      setError('Vui lòng cung cấp mô tả công việc (dán văn bản hoặc tải file).')
      return
    }

    if (!connectedWallet?.signer) {
      setError('Vui lòng kết nối ví Solana có thể ký giao dịch trước khi đánh giá.')
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
    try {
      const evaluation = await submitEvaluation(
        formData,
        createPaymentFetch(connectedWallet.signer),
      )
      const encoded = encodeURIComponent(JSON.stringify(evaluation))
      router.push(`/result?data=${encoded}`)
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : 'Không thể đánh giá CV. Vui lòng thử lại.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-x-clip bg-bg1 text-foreground">
      <main className="relative z-10 mx-auto flex min-h-screen max-w-4xl flex-col gap-10 border-x border-border-low px-6 py-16">
        <header className="space-y-3 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Đánh giá CV
          </h1>
          <p className="text-sm text-muted">
            Tải CV và cung cấp mô tả công việc để nhận đánh giá phù hợp.
          </p>
        </header>

        <section className="rounded-2xl border border-border-low bg-card p-4 text-sm shadow-[0_20px_80px_-50px_rgba(0,0,0,0.35)]">
          {connectedWallet ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-muted">
                Ví đã kết nối:{' '}
                <span className="font-medium text-foreground">
                  {connectedWallet.account.address}
                </span>
              </p>
              <button
                type="button"
                onClick={() => disconnect.dispatch()}
                disabled={isSubmitting || disconnect.isRunning}
                className="rounded-lg border border-border-low px-3 py-2 font-medium transition hover:border-foreground/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Ngắt kết nối
              </button>
            </div>
          ) : wallets.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-muted">Kết nối ví Solana để thanh toán đánh giá.</p>
              <div className="flex flex-wrap gap-2">
                {wallets.map((wallet) => (
                  <button
                    key={wallet.name}
                    type="button"
                    onClick={() => connect.dispatch(wallet)}
                    disabled={isSubmitting || connect.isRunning}
                    className="rounded-lg border border-border-low px-3 py-2 font-medium transition hover:border-foreground/30 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Kết nối {wallet.name}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-muted">
              Không tìm thấy ví Solana tương thích. Hãy cài ví hỗ trợ Wallet Standard và chọn đúng mạng.
            </p>
          )}
        </section>

        {error && (
          <div
            className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-center text-sm text-foreground"
            role="alert"
          >
            {error}
          </div>
        )}

        {isSubmitting && (
          <div
            className="rounded-lg border border-border-low bg-cream/50 px-4 py-3 text-center text-sm text-muted"
            role="status"
          >
            Đang phân tích CV, vui lòng chờ trong giây lát...
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="h-full rounded-2xl border border-border-low bg-card p-6 shadow-[0_20px_80px_-50px_rgba(0,0,0,0.35)]">
              <h2 className="mb-3 text-base font-semibold">CV của bạn</h2>
              <UploadZone
                name="cv"
                accept=".pdf,.docx"
                file={cvFile}
                onFileChange={setCvFile}
                hint="PDF, DOCX"
                disabled={isSubmitting}
              />
            </div>

            <div className="h-full rounded-2xl border border-border-low bg-card p-6 shadow-[0_20px_80px_-50px_rgba(0,0,0,0.35)]">
              <h2 className="mb-3 text-base font-semibold">
                Mô tả công việc (JD)
              </h2>

              <div className="mb-4 inline-flex gap-2">
                <button
                  type="button"
                  onClick={() => setJdMode('text')}
                  disabled={isSubmitting}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${jdMode === 'text' ? 'border-foreground bg-foreground text-background' : 'border-border-low bg-card text-foreground hover:-translate-y-0.5'}`}
                >
                  Dán văn bản
                </button>
                <button
                  type="button"
                  onClick={() => setJdMode('file')}
                  disabled={isSubmitting}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${jdMode === 'file' ? 'border-foreground bg-foreground text-background' : 'border-border-low bg-card text-foreground hover:-translate-y-0.5'}`}
                >
                  Tải file
                </button>
              </div>

              {jdMode === 'text' ? (
                <textarea
                  className="w-full rounded-lg border border-border-low bg-card px-4 py-2.5 text-sm outline-none transition placeholder:text-muted focus:border-foreground/30 disabled:cursor-not-allowed disabled:opacity-60"
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
            </div>
          </div>

          <div className="mt-6 text-center">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-foreground px-12 py-2.5 text-sm font-medium text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? 'Đang đánh giá...' : 'Đánh giá'}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
