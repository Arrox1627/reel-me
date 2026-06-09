'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { subscribeToPush } from '@/lib/push'

export default function SetupPage() {
  const [step, setStep] = useState<'info' | 'permissions'>('info')
  const [name, setName] = useState('')
  const [reminderTime, setReminderTime] = useState('08:00')
  const [timezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone)
  const [localOnly, setLocalOnly] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notifStatus, setNotifStatus] = useState<'idle' | 'granted' | 'denied' | 'unsupported'>('idle')
  const [cameraStatus, setCameraStatus] = useState<'idle' | 'granted' | 'denied'>('idle')
  const router = useRouter()
  const supabase = createClient()

  async function handleInfo(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      display_name: name || user.email?.split('@')[0] || 'Friend',
      reminder_time: reminderTime,
      timezone,
      default_pose: 'front',
      notifications_enabled: true,
      local_only_mode: localOnly,
    })

    if (error) { setError(error.message); setLoading(false); return }
    setLoading(false)
    setStep('permissions')
  }

  async function requestNotifications() {
    if (!('Notification' in window)) { setNotifStatus('unsupported'); return }
    const perm = await Notification.requestPermission()
    if (perm === 'granted') {
      setNotifStatus('granted')
      try { await subscribeToPush() } catch {}
    } else {
      setNotifStatus('denied')
    }
  }

  async function requestCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      stream.getTracks().forEach(t => t.stop())
      setCameraStatus('granted')
    } catch {
      setCameraStatus('denied')
    }
  }

  function finish() { router.push('/') }

  if (step === 'permissions') {
    return (
      <main className="min-h-dvh flex flex-col items-center justify-center px-6 py-12">
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[-10%] right-[-5%] w-80 h-80 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(245,166,35,0.07) 0%, transparent 70%)', filter: 'blur(50px)' }} />
          <div className="absolute bottom-[10%] left-[-10%] w-72 h-72 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(120,80,200,0.06) 0%, transparent 70%)', filter: 'blur(50px)' }} />
        </div>

        <div className="w-full max-w-sm fade-up">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center mb-6"
            style={{ background: 'rgba(245,166,35,0.12)', border: '1px solid rgba(245,166,35,0.25)' }}>
            <span className="text-lg">🔐</span>
          </div>
          <h1 className="text-2xl font-black mb-1 tracking-tight" style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
            Two quick permissions
          </h1>
          <p className="text-sm mb-8" style={{ color: 'var(--text-muted)' }}>
            REEL ME works best with access to your camera and notifications.
          </p>

          <div className="space-y-3 mb-8">
            {/* Camera */}
            <div className="rounded-2xl p-5 glass">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-none"
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid var(--glass-border)' }}>
                  <span className="text-lg">📷</span>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm mb-1" style={{ color: 'var(--text-primary)' }}>Camera</p>
                  <p className="text-xs mb-3 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                    Needed to capture your daily frame and show the ghost overlay for alignment.
                  </p>
                  {cameraStatus === 'idle' && (
                    <button onClick={requestCamera}
                      className="px-4 py-2 rounded-xl text-xs font-bold active:scale-95 transition-all btn-accent">
                      Allow Camera
                    </button>
                  )}
                  {cameraStatus === 'granted' && (
                    <span className="text-xs font-semibold" style={{ color: '#34c759' }}>✓ Allowed</span>
                  )}
                  {cameraStatus === 'denied' && (
                    <span className="text-xs" style={{ color: 'var(--danger)' }}>Denied — allow it later in browser settings.</span>
                  )}
                </div>
              </div>
            </div>

            {/* Notifications */}
            <div className="rounded-2xl p-5 glass">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-none"
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid var(--glass-border)' }}>
                  <span className="text-lg">🔔</span>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm mb-1" style={{ color: 'var(--text-primary)' }}>Daily reminder</p>
                  <p className="text-xs mb-3 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                    One tap a day at your chosen time. No other notifications, ever.
                  </p>
                  {notifStatus === 'idle' && (
                    <button onClick={requestNotifications}
                      className="px-4 py-2 rounded-xl text-xs font-bold active:scale-95 transition-all btn-accent">
                      Allow Notifications
                    </button>
                  )}
                  {notifStatus === 'granted' && (
                    <span className="text-xs font-semibold" style={{ color: '#34c759' }}>✓ All set</span>
                  )}
                  {notifStatus === 'denied' && (
                    <span className="text-xs" style={{ color: 'var(--danger)' }}>Denied — allow it later in Settings.</span>
                  )}
                  {notifStatus === 'unsupported' && (
                    <div>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Push not supported in this browser.</span>
                      {/iPhone|iPad|iPod/.test(navigator.userAgent) && (
                        <p className="text-xs mt-1" style={{ color: 'var(--accent)' }}>
                          On iOS: tap Share → &quot;Add to Home Screen&quot; first.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <button onClick={finish}
            className="w-full py-3.5 rounded-2xl font-bold text-sm active:scale-95 transition-all btn-accent">
            Let&apos;s go →
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-6 py-12">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] right-[-5%] w-80 h-80 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(245,166,35,0.08) 0%, transparent 70%)', filter: 'blur(50px)' }} />
        <div className="absolute bottom-[10%] left-[-10%] w-64 h-64 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(120,80,200,0.06) 0%, transparent 70%)', filter: 'blur(50px)' }} />
      </div>

      <div className="w-full max-w-sm fade-up">
        <div className="mb-8">
          <div className="text-xs font-bold tracking-widest mb-3 uppercase" style={{ color: 'var(--accent)' }}>
            REEL ME
          </div>
          <h1 className="text-2xl font-black tracking-tight mb-1" style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
            Quick setup
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>30 seconds. We only ask once.</p>
        </div>

        <form onSubmit={handleInfo} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              What should we call you?
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your name (optional)"
              className="w-full px-4 py-3.5 rounded-2xl text-sm outline-none transition-all"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)' }}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              Daily reminder time
            </label>
            <input
              type="time"
              required
              value={reminderTime}
              onChange={e => setReminderTime(e.target.value)}
              className="w-full px-4 py-3.5 rounded-2xl text-sm outline-none transition-all"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)' }}
            />
            <p className="text-xs mt-2 px-1" style={{ color: 'var(--text-muted)' }}>
              {timezone}
            </p>
          </div>

          {/* Local-only toggle */}
          <button type="button" onClick={() => setLocalOnly(v => !v)}
            className="w-full flex items-start gap-3 rounded-2xl p-4 text-left transition-all"
            style={{
              background: localOnly ? 'rgba(245,166,35,0.08)' : 'rgba(255,255,255,0.06)',
              border: `1px solid ${localOnly ? 'rgba(245,166,35,0.35)' : 'var(--glass-border)'}`,
            }}>
            <div className="mt-0.5 w-5 h-5 rounded-md flex items-center justify-center flex-none transition-all"
              style={{ background: localOnly ? 'linear-gradient(135deg,#f5a623,#e8960f)' : 'rgba(255,255,255,0.1)', border: localOnly ? 'none' : '1px solid var(--glass-border)' }}>
              {localOnly && (
                <svg width="10" height="10" fill="none" stroke="#000" strokeWidth={2.5} viewBox="0 0 12 12">
                  <polyline points="2,6 5,9 10,3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Local-only mode</p>
              <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                Store frames on this device only — no photos uploaded to a server.
              </p>
            </div>
          </button>

          {error && (
            <div className="px-4 py-3 rounded-2xl text-sm" style={{ background: 'rgba(255,69,58,0.12)', border: '1px solid rgba(255,69,58,0.2)', color: '#ff453a' }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading}
            className="w-full py-3.5 rounded-2xl font-bold text-sm active:scale-95 transition-all btn-accent"
            style={{ opacity: loading ? 0.7 : 1, marginTop: 8 }}>
            {loading ? 'Saving…' : 'Continue →'}
          </button>
        </form>
      </div>
    </main>
  )
}
