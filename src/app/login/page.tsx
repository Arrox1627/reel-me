'use client'

import { Suspense, useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'

function LoginForm() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    if (searchParams.get('error') === 'auth_failed') {
      setError('Authentication failed. Please try again.')
    }
  }, [searchParams])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${location.origin}/auth/callback` },
      })
      if (error) setError(error.message)
      else setMessage('Check your email for a confirmation link.')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
      else router.push('/')
    }
    setLoading(false)
  }

  async function handleGoogle() {
    setLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback` },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-6 py-12"
      style={{ background: 'var(--bg-base)' }}>

      {/* Logo / brand */}
      <div className="mb-10 text-center">
        <div className="text-5xl font-black tracking-tighter mb-2"
          style={{ color: 'var(--accent)', fontVariant: 'small-caps', letterSpacing: '-0.04em' }}>
          REEL ME
        </div>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Your transformation, frame by frame
        </p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm rounded-2xl p-6"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>

        {/* Tab toggle */}
        <div className="flex rounded-xl p-1 mb-6"
          style={{ background: 'var(--bg-elevated)' }}>
          {(['signin', 'signup'] as const).map((m) => (
            <button key={m} onClick={() => { setMode(m); setError(''); setMessage('') }}
              className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{
                background: mode === m ? 'var(--accent)' : 'transparent',
                color: mode === m ? '#000' : 'var(--text-secondary)',
              }}>
              {m === 'signin' ? 'Sign in' : 'Sign up'}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5"
              style={{ color: 'var(--text-secondary)' }}>Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
              }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5"
              style={{ color: 'var(--text-secondary)' }}>Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          {error && (
            <p className="text-sm px-3 py-2 rounded-lg"
              style={{ background: '#3f1111', color: '#fca5a5' }}>{error}</p>
          )}
          {message && (
            <p className="text-sm px-3 py-2 rounded-lg"
              style={{ background: '#1a2f1a', color: '#86efac' }}>{message}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl font-bold text-sm transition-all active:scale-95"
            style={{ background: 'var(--accent)', color: '#000', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>or</span>
          <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
        </div>

        {/* Google OAuth */}
        <button
          onClick={handleGoogle}
          disabled={loading}
          className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2.5 transition-all active:scale-95"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>
      </div>

      <p className="mt-6 text-xs text-center" style={{ color: 'var(--text-muted)' }}>
        Your photos are private and encrypted.<br />Only you can see them.
      </p>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-dvh flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
        <div className="text-2xl font-black" style={{ color: 'var(--accent)' }}>REEL ME</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
