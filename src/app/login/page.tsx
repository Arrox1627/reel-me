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
        email, password,
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
    if (error) { setError(error.message); setLoading(false) }
  }

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-5 py-12 relative overflow-hidden">
      {/* Background orbs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-96 h-96 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(245,166,35,0.12) 0%, transparent 70%)', filter: 'blur(40px)' }} />
        <div className="absolute bottom-[-10%] right-[-15%] w-80 h-80 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(120,80,200,0.1) 0%, transparent 70%)', filter: 'blur(50px)' }} />
      </div>

      {/* Logo */}
      <div className="mb-10 text-center fade-up">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
          style={{ background: 'linear-gradient(135deg, rgba(245,166,35,0.2), rgba(245,166,35,0.08))', border: '1px solid rgba(245,166,35,0.3)' }}>
          <span className="text-2xl">🎞️</span>
        </div>
        <h1 className="text-3xl font-black tracking-tight" style={{ color: 'var(--text-primary)', letterSpacing: '-0.04em' }}>
          REEL ME
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Your transformation, frame by frame
        </p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm rounded-3xl p-6 fade-up glass"
        style={{ animationDelay: '0.05s' }}>

        {/* Mode toggle */}
        <div className="flex rounded-2xl p-1 mb-6"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)' }}>
          {(['signin', 'signup'] as const).map(m => (
            <button key={m} onClick={() => { setMode(m); setError(''); setMessage('') }}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
              style={{
                background: mode === m ? 'linear-gradient(135deg, #f5a623, #e8960f)' : 'transparent',
                color: mode === m ? '#000' : 'var(--text-secondary)',
                boxShadow: mode === m ? '0 2px 12px rgba(245,166,35,0.3)' : 'none',
              }}>
              {m === 'signin' ? 'Sign in' : 'Sign up'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full px-4 py-3.5 rounded-2xl text-sm transition-all"
              style={{
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid var(--glass-border)',
                color: 'var(--text-primary)',
              }} />
          </div>
          <div>
            <input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full px-4 py-3.5 rounded-2xl text-sm transition-all"
              style={{
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid var(--glass-border)',
                color: 'var(--text-primary)',
              }} />
          </div>

          {error && (
            <div className="px-4 py-3 rounded-2xl text-xs" style={{ background: 'var(--danger-glass)', border: '1px solid rgba(255,69,58,0.25)', color: '#ff6b6b' }}>
              {error}
            </div>
          )}
          {message && (
            <div className="px-4 py-3 rounded-2xl text-xs" style={{ background: 'rgba(52,199,89,0.15)', border: '1px solid rgba(52,199,89,0.25)', color: '#34c759' }}>
              {message}
            </div>
          )}

          <button type="submit" disabled={loading}
            className="w-full py-3.5 rounded-2xl text-sm btn-accent transition-all"
            style={{ opacity: loading ? 0.7 : 1, marginTop: '4px' }}>
            {loading ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px" style={{ background: 'var(--glass-border)' }} />
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>or</span>
          <div className="flex-1 h-px" style={{ background: 'var(--glass-border)' }} />
        </div>

        <button onClick={handleGoogle} disabled={loading}
          className="w-full py-3.5 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2.5 btn-glass transition-all">
          <GoogleIcon />
          Continue with Google
        </button>
      </div>

      <p className="mt-6 text-xs text-center fade-up" style={{ color: 'var(--text-muted)', animationDelay: '0.1s' }}>
        Photos are private by default · Only you can see them
      </p>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-dvh flex items-center justify-center">
        <span className="text-2xl font-black tracking-tight" style={{ color: 'var(--accent)' }}>REEL ME</span>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}
