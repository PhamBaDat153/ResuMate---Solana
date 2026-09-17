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
  deriveProfileAddress,
  fetchProfile,
  type UserProfile,
} from '@/lib/profileProgram'

type ProfileState = 'idle' | 'loading' | 'missing' | 'existing' | 'creating' | 'error'

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

  const loadProfile = useCallback(async () => {
    if (!connectedWallet) {
      setProfile(null)
      setProfileAddress(null)
      setState('idle')
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
                <dl className="grid gap-4 sm:grid-cols-2">
                  <div><dt className="text-sm text-muted">Profile PDA</dt><dd className="mt-1 break-all font-mono text-xs">{profile.address}</dd></div>
                  <div><dt className="text-sm text-muted">Owner</dt><dd className="mt-1 break-all font-mono text-xs">{profile.owner}</dd></div>
                  <div><dt className="text-sm text-muted">Resume count</dt><dd className="mt-1 text-xl font-semibold">{profile.resumeCount.toString()}</dd></div>
                  <div><dt className="text-sm text-muted">Credential count</dt><dd className="mt-1 text-xl font-semibold">{profile.credentialCount.toString()}</dd></div>
                </dl>
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
