'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { subscribeToPush } from '@/lib/push'

const TIMEZONES = Intl.supportedValuesOf('timeZone').slice(0, 10)

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
      <main className="min-h-dvh flex flex-col items-center justify-center px-6 py-12"
        style={{ background: 'var(--bg-base)' }}>
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-black mb-1" style={{ color: 'var(--text-primary)' }}>
            Two quick permissions
          </h1>
          <p className="text-sm mb-8" style={{ color: 'var(--text-muted)' }}>
            REEL ME works best with access to your camera and notifications.
          </p>

          <div className="space-y-4 mb-8">
            {/* Camera */}
            <div className="rounded-2xl p-5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <div className="flex items-start gap-4">
                <div className="text-2xl">📷</div>
                <div className="flex-1">
                  <p className="font-semibold text-sm mb-1" style={{ color: 'var(--text-primary)' }}>Camera</p>
                  <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                    We need the camera to capture your daily frame and show the ghost overlay for alignment.
                  </p>
                  {cameraStatus === 'idle' && (
                    <button onClick={requestCamera}
                      className="px-4 py-2 rounded-lg text-xs font-semibold active:scale-95 transition-all"
                      style={{ background: 'var(--accent)', color: '#000' }}>
                      Allow Camera
                    </button>
                  )}
                  {cameraStatus === 'granted' && <span className="text-xs text-green-400 font-semibold">✓ Allowed</span>}
                  {cameraStatus === 'denied' && <span className="text-xs" style={{ color: 'var(--danger)' }}>Denied — you can allow it later in browser settings.</span>}
                </div>
              </div>
            </div>

            {/* Notifications */}
            <div className="rounded-2xl p-5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <div className="flex items-start gap-4">
                <div className="text-2xl">🔔</div>
                <div className="flex-1">
                  <p className="font-semibold text-sm mb-1" style={{ color: 'var(--text-primary)' }}>Daily reminder</p>
                  <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                    We&apos;ll tap you once a day at your chosen time. No other notifications, ever.
                  </p>
                  {notifStatus === 'idle' && (
                    <button onClick={requestNotifications}
                      className="px-4 py-2 rounded-lg text-xs font-semibold active:scale-95 transition-all"
                      style={{ background: 'var(--accent)', color: '#000' }}>
                      Allow Notifications
                    </button>
                  )}
                  {notifStatus === 'granted' && <span className="text-xs text-green-400 font-semibold">✓ All set</span>}
                  {notifStatus === 'denied' && <span className="text-xs" style={{ color: 'var(--danger)' }}>Denied — you can allow it later in Settings.</span>}
                  {notifStatus === 'unsupported' && (
                    <div>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Push not supported in this browser.</span>
                      {/iPhone|iPad|iPod/.test(navigator.userAgent) && (
                        <p className="text-xs mt-1" style={{ color: 'var(--accent)' }}>
                          On iOS: tap Share → &quot;Add to Home Screen&quot; first, then open the installed app to enable notifications.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <button onClick={finish}
            className="w-full py-3.5 rounded-xl font-bold text-sm active:scale-95 transition-all"
            style={{ background: 'var(--accent)', color: '#000' }}>
            Let&apos;s go →
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-6 py-12"
      style={{ background: 'var(--bg-base)' }}>
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <div className="text-3xl font-black mb-1" style={{ color: 'var(--accent)' }}>REEL ME</div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Quick setup</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>30 seconds. We only ask once.</p>
        </div>

        <form onSubmit={handleInfo} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              What should we call you?
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your name (optional)"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Daily reminder time
            </label>
            <input
              type="time"
              required
              value={reminderTime}
              onChange={e => setReminderTime(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            />
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Detected timezone: {timezone}
            </p>
          </div>

          {/* Local-only mode */}
          <label className="flex items-start gap-3 rounded-xl p-4 cursor-pointer"
            style={{ background: 'var(--bg-elevated)', border: `1px solid ${localOnly ? 'var(--accent)' : 'var(--border)'}` }}>
            <input
              type="checkbox"
              checked={localOnly}
              onChange={e => setLocalOnly(e.target.checked)}
              className="mt-0.5 accent-amber-500"
            />
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Local-only mode</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Store frames on this device only — no photos uploaded to a server. You can export at any time.
              </p>
            </div>
          </label>

          {error && <p className="text-sm px-3 py-2 rounded-lg" style={{ background: '#3f1111', color: '#fca5a5' }}>{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full py-3.5 rounded-xl font-bold text-sm active:scale-95 transition-all"
            style={{ background: 'var(--accent)', color: '#000', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Saving…' : 'Continue →'}
          </button>
        </form>
      </div>
    </main>
  )
}
