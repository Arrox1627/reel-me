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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<'all' | 'account' | null>(null)
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
    if (typeof window !== 'undefined' && isIOS() && !isStandaloneMode()) setIosPrompt(true)
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
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function toggleNotifications(enabled: boolean) {
    setNotificationsEnabled(enabled)
    if (enabled) {
      const perm = await Notification.requestPermission()
      if (perm === 'granted') await subscribeToPush()
      else setNotificationsEnabled(false)
    } else {
      await unsubscribeFromPush()
      await fetch('/api/subscribe', { method: 'DELETE' })
    }
  }

  async function deleteAllPhotos() {
    setDeleting(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: files } = await supabase.storage.from('photos').list(user.id, { limit: 1000 })
    if (files?.length) {
      for (const folder of files) {
        const { data: sub } = await supabase.storage.from('photos').list(`${user.id}/${folder.name}`, { limit: 1000 })
        if (sub?.length) await supabase.storage.from('photos').remove(sub.map(f => `${user.id}/${folder.name}/${f.name}`))
      }
    }
    await supabase.from('photos').delete().eq('user_id', user.id)
    await clearAllLocalPhotos()
    setDeleting(false); setShowDeleteConfirm(null)
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

  if (loading) {
    return <div className="min-h-dvh flex items-center justify-center"><p style={{ color: 'var(--text-muted)' }}>Loading…</p></div>
  }

  return (
    <div className="min-h-dvh px-4 pt-12 pb-8">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(120,80,200,0.07) 0%, transparent 70%)', filter: 'blur(50px)' }} />
      </div>

      <h1 className="text-2xl font-black tracking-tight mb-7 fade-up"
        style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>Settings</h1>

      {/* iOS prompt */}
      {iosPrompt && (
        <div className="rounded-2xl p-4 mb-5 flex gap-3 fade-up"
          style={{ background: 'rgba(245,166,35,0.1)', border: '1px solid rgba(245,166,35,0.25)' }}>
          <span className="text-xl flex-none">📲</span>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>Add to Home Screen</p>
            <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Tap <strong style={{ color: 'var(--text-secondary)' }}>Share</strong> → <strong style={{ color: 'var(--text-secondary)' }}>Add to Home Screen</strong> to enable daily notifications on iOS.
            </p>
          </div>
        </div>
      )}

      {/* Reminder */}
      <SettingsSection title="Reminder" delay={0.04}>
        <SettingsRow label="Time">
          <input type="time" value={reminderTime} onChange={e => setReminderTime(e.target.value)}
            className="px-3 py-2 rounded-xl text-sm transition-all"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)' }} />
        </SettingsRow>
        <SettingsRow label="Notifications">
          <GlassToggle checked={notificationsEnabled} onChange={toggleNotifications} />
        </SettingsRow>
        <p className="text-xs pt-1 px-1" style={{ color: 'var(--text-muted)' }}>
          {profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone}
        </p>
      </SettingsSection>

      {/* Capture */}
      <SettingsSection title="Capture" delay={0.08}>
        <SettingsRow label="Default pose">
          <div className="flex gap-1.5">
            {(['front', 'side', 'back'] as Pose[]).map(p => (
              <button key={p} onClick={() => setDefaultPose(p)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all active:scale-90"
                style={defaultPose === p
                  ? { background: 'linear-gradient(135deg,#f5a623,#e8960f)', color: '#000' }
                  : { background: 'rgba(255,255,255,0.07)', color: 'var(--text-secondary)', border: '1px solid var(--glass-border)' }}>
                {p}
              </button>
            ))}
          </div>
        </SettingsRow>
        <SettingsRow label="Local-only mode">
          <GlassToggle checked={localOnly} onChange={setLocalOnly} />
        </SettingsRow>
        {localOnly && (
          <p className="text-xs pt-1 px-1" style={{ color: 'var(--accent)' }}>
            Photos stored on-device only — no uploads.
          </p>
        )}
      </SettingsSection>

      {/* Save button */}
      <button onClick={saveSettings} disabled={saving}
        className="w-full py-3.5 rounded-2xl font-bold text-sm active:scale-95 transition-all mb-5 fade-up btn-accent"
        style={{ opacity: saving ? 0.7 : 1, animationDelay: '0.12s' }}>
        {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save settings'}
      </button>

      {/* Data */}
      <SettingsSection title="Data & Privacy" delay={0.15}>
        <button onClick={() => setShowDeleteConfirm('all')}
          className="w-full py-3 text-sm font-semibold text-left px-1 active:scale-95 transition-all"
          style={{ color: 'var(--danger)' }}>
          Delete all photos
        </button>
        <div className="h-px" style={{ background: 'var(--glass-border)' }} />
        <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))}
          className="w-full py-3 text-sm font-semibold text-left px-1 active:scale-95 transition-all"
          style={{ color: 'var(--text-secondary)' }}>
          Sign out
        </button>
        <div className="h-px" style={{ background: 'var(--glass-border)' }} />
        <button onClick={() => setShowDeleteConfirm('account')}
          className="w-full py-3 text-sm font-semibold text-left px-1 active:scale-95 transition-all"
          style={{ color: 'var(--danger)' }}>
          Delete account & all data
        </button>
      </SettingsSection>

      {/* Confirm sheet */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-8"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
          onClick={() => setShowDeleteConfirm(null)}>
          <div className="w-full max-w-sm rounded-3xl p-6 glass-bright"
            onClick={e => e.stopPropagation()}>
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'rgba(255,69,58,0.15)', border: '1px solid rgba(255,69,58,0.2)' }}>
              <span className="text-lg">⚠️</span>
            </div>
            <p className="font-bold text-base mb-2" style={{ color: 'var(--text-primary)' }}>
              {showDeleteConfirm === 'account' ? 'Delete account?' : 'Delete all photos?'}
            </p>
            <p className="text-sm mb-6 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              {showDeleteConfirm === 'account'
                ? 'Permanently deletes your account, all photos, and all data. This cannot be undone.'
                : 'Permanently deletes all your progress photos. Your account will remain. This cannot be undone.'}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 py-3.5 rounded-2xl font-semibold text-sm btn-glass">
                Cancel
              </button>
              <button onClick={showDeleteConfirm === 'account' ? deleteAccount : deleteAllPhotos}
                disabled={deleting}
                className="flex-1 py-3.5 rounded-2xl font-bold text-sm active:scale-95 transition-all"
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

function SettingsSection({ title, children, delay = 0 }: { title: string; children: React.ReactNode; delay?: number }) {
  return (
    <div className="mb-5 fade-up" style={{ animationDelay: `${delay}s` }}>
      <p className="text-xs font-semibold uppercase tracking-wider mb-2 px-1" style={{ color: 'var(--text-muted)' }}>
        {title}
      </p>
      <div className="rounded-2xl px-4 py-1 glass">
        {children}
      </div>
    </div>
  )
}

function SettingsRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3">
      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      {children}
    </div>
  )
}

function GlassToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)}
      className="relative rounded-full transition-all active:scale-90"
      style={{ width: 44, height: 26, background: checked ? 'linear-gradient(135deg,#f5a623,#e8960f)' : 'rgba(255,255,255,0.1)', border: '1px solid var(--glass-border)', boxShadow: checked ? '0 2px 10px rgba(245,166,35,0.3)' : 'none' }}>
      <div className="absolute top-0.5 rounded-full transition-all"
        style={{ width: 22, height: 22, background: '#fff', left: checked ? 20 : 2, boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }} />
    </button>
  )
}
