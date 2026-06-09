'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import { subscribeToPush, unsubscribeFromPush, isIOS, isStandaloneMode } from '@/lib/push'
import { clearAllLocalPhotos } from '@/lib/idb/photos'
import type { Pose } from '@/types/database'

export default function SettingsPage() {
  const { profile, loading } = useProfile()
  const [reminderTime, setReminderTime] = useState('08:00')
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [defaultPose, setDefaultPose] = useState<Pose>('front')
  const [localOnly, setLocalOnly] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<'photo' | 'all' | 'account' | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [iosPrompt, setIosPrompt] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (profile) {
      setReminderTime(profile.reminder_time || '08:00')
      setNotificationsEnabled(profile.notifications_enabled)
      setDefaultPose(profile.default_pose)
      setLocalOnly(profile.local_only_mode)
    }
  }, [profile])

  useEffect(() => {
    if (typeof window !== 'undefined' && isIOS() && !isStandaloneMode()) {
      setIosPrompt(true)
    }
  }, [])

  async function saveSettings() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('profiles').update({
      reminder_time: reminderTime,
      notifications_enabled: notificationsEnabled,
      default_pose: defaultPose,
      local_only_mode: localOnly,
    }).eq('id', user.id)

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function toggleNotifications(enabled: boolean) {
    setNotificationsEnabled(enabled)
    if (enabled) {
      const perm = await Notification.requestPermission()
      if (perm === 'granted') {
        await subscribeToPush()
      } else {
        setNotificationsEnabled(false)
      }
    } else {
      await unsubscribeFromPush()
      await fetch('/api/subscribe', { method: 'DELETE' })
    }
  }

  async function deleteAllPhotos() {
    setDeleting(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // List and delete all files
    const { data: files } = await supabase.storage.from('photos').list(user.id, { limit: 1000 })
    if (files?.length) {
      // Recursively delete pose folders
      for (const folder of files) {
        const { data: subFiles } = await supabase.storage
          .from('photos')
          .list(`${user.id}/${folder.name}`, { limit: 1000 })
        if (subFiles?.length) {
          await supabase.storage.from('photos')
            .remove(subFiles.map(f => `${user.id}/${folder.name}/${f.name}`))
        }
      }
    }

    await supabase.from('photos').delete().eq('user_id', user.id)
    await clearAllLocalPhotos()
    setDeleting(false)
    setShowDeleteConfirm(null)
  }

  async function deleteAccount() {
    setDeleting(true)
    await deleteAllPhotos()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('push_subscriptions').delete().eq('user_id', user.id)
      await supabase.from('profiles').delete().eq('id', user.id)
    }
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return <div className="min-h-dvh flex items-center justify-center"><p style={{ color: 'var(--text-muted)' }}>Loading…</p></div>
  }

  return (
    <div className="min-h-dvh px-5 pt-10 pb-8">
      <h1 className="text-2xl font-black mb-8" style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
        Settings
      </h1>

      {/* iOS add to home screen prompt */}
      {iosPrompt && (
        <div className="rounded-2xl p-4 mb-5 flex gap-3"
          style={{ background: '#1a1600', border: '1px solid var(--accent)' }}>
          <span className="text-xl">📲</span>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>Install for better notifications</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              On iOS, tap <strong style={{ color: 'var(--text-secondary)' }}>Share</strong> → <strong style={{ color: 'var(--text-secondary)' }}>Add to Home Screen</strong> to enable daily push notifications.
            </p>
          </div>
        </div>
      )}

      {/* Reminder */}
      <Section title="Daily reminder">
        <Row label="Time">
          <input type="time" value={reminderTime} onChange={e => setReminderTime(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
        </Row>
        <Row label="Notifications">
          <Toggle checked={notificationsEnabled} onChange={toggleNotifications} />
        </Row>
        <p className="text-xs px-1 pt-1" style={{ color: 'var(--text-muted)' }}>
          Timezone: {profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone}
        </p>
      </Section>

      {/* Capture */}
      <Section title="Capture">
        <Row label="Default pose">
          <div className="flex gap-1.5">
            {(['front', 'side', 'back'] as Pose[]).map(p => (
              <button key={p} onClick={() => setDefaultPose(p)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all active:scale-90"
                style={{ background: defaultPose === p ? 'var(--accent)' : 'var(--bg-elevated)', color: defaultPose === p ? '#000' : 'var(--text-muted)', border: '1px solid var(--border)' }}>
                {p}
              </button>
            ))}
          </div>
        </Row>
        <Row label="Local-only mode">
          <Toggle checked={localOnly} onChange={setLocalOnly} />
        </Row>
        {localOnly && (
          <p className="text-xs px-1 pt-1" style={{ color: 'var(--accent)' }}>
            Photos stored on this device only — no server uploads.
          </p>
        )}
      </Section>

      {/* Save */}
      <button onClick={saveSettings} disabled={saving}
        className="w-full py-3.5 rounded-2xl font-bold text-sm active:scale-95 transition-all mb-6"
        style={{ background: saved ? '#22c55e' : 'var(--accent)', color: '#000', opacity: saving ? 0.7 : 1 }}>
        {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save settings'}
      </button>

      {/* Privacy & data */}
      <Section title="Privacy & data">
        <button onClick={() => setShowDeleteConfirm('all')}
          className="w-full py-3 rounded-xl text-sm font-semibold text-left px-4 active:scale-95 transition-all"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--danger)' }}>
          Delete all photos
        </button>
        <button onClick={signOut}
          className="w-full py-3 rounded-xl text-sm font-semibold text-left px-4 active:scale-95 transition-all mt-2"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
          Sign out
        </button>
        <button onClick={() => setShowDeleteConfirm('account')}
          className="w-full py-3 rounded-xl text-sm font-semibold text-left px-4 active:scale-95 transition-all mt-2"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--danger)' }}>
          Delete account & all data
        </button>
      </Section>

      {/* Confirm dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-6"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={() => setShowDeleteConfirm(null)}>
          <div className="w-full max-w-sm rounded-2xl p-6"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
            onClick={e => e.stopPropagation()}>
            <p className="font-bold text-base mb-2" style={{ color: 'var(--text-primary)' }}>
              {showDeleteConfirm === 'account' ? 'Delete account?' : 'Delete all photos?'}
            </p>
            <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
              {showDeleteConfirm === 'account'
                ? 'This will permanently delete your account, all photos, and all data. This cannot be undone.'
                : 'This will permanently delete all your progress photos. Your account will remain. This cannot be undone.'}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 py-3 rounded-xl font-semibold text-sm"
                style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
                Cancel
              </button>
              <button
                onClick={showDeleteConfirm === 'account' ? deleteAccount : deleteAllPhotos}
                disabled={deleting}
                className="flex-1 py-3 rounded-xl font-bold text-sm"
                style={{ background: 'var(--danger)', color: 'white', opacity: deleting ? 0.7 : 1 }}>
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <p className="text-xs font-semibold uppercase tracking-wider mb-3 px-1" style={{ color: 'var(--text-muted)' }}>
        {title}
      </p>
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <div className="px-4 py-3 space-y-3">{children}</div>
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      {children}
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)}
      className="relative w-12 h-7 rounded-full transition-all active:scale-90"
      style={{ background: checked ? 'var(--accent)' : 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
      <div className="absolute top-0.5 rounded-full transition-all"
        style={{ width: 24, height: 24, background: '#fff', left: checked ? 22 : 2 }} />
    </button>
  )
}
