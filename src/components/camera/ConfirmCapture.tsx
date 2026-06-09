'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { saveLocalPhoto } from '@/lib/idb/photos'
import { useProfile } from '@/hooks/useProfile'
import type { Pose } from '@/types/database'

interface Props {
  blob: Blob
  pose: Pose
  onRetake: () => void
}

export default function ConfirmCapture({ blob, pose, onRetake }: Props) {
  const previewUrl = useRef(URL.createObjectURL(blob))
  const [ghostUrl, setGhostUrl] = useState<string | null>(null)
  const [showGhost, setShowGhost] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const { profile } = useProfile()
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    return () => URL.revokeObjectURL(previewUrl.current)
  }, [])

  // Load ghost for comparison
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('photos')
        .select('storage_path')
        .eq('user_id', user.id)
        .eq('pose', pose)
        .order('date', { ascending: false })
        .limit(1)
        .single()
      if (!data) return
      const { data: signed } = await supabase.storage
        .from('photos')
        .createSignedUrl(data.storage_path, 3600)
      setGhostUrl(signed?.signedUrl ?? null)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pose])

  async function save() {
    setSaving(true)
    setError('')
    const today = new Date().toISOString().split('T')[0]

    try {
      if (profile?.local_only_mode) {
        await saveLocalPhoto({ date: today, pose, blob })
        router.push('/?saved=1')
        return
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not signed in')

      const filename = `${user.id}/${pose}/${today}_${Date.now()}.jpg`
      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(filename, blob, { contentType: 'image/jpeg', upsert: false })

      if (uploadError) throw uploadError

      const { error: insertError } = await supabase.from('photos').insert({
        user_id: user.id,
        date: today,
        pose,
        storage_path: filename,
      })

      if (insertError) {
        await supabase.storage.from('photos').remove([filename])
        throw insertError
      }

      router.push('/?saved=1')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: '#000' }}>
      {/* Preview */}
      <div className="relative flex-1 overflow-hidden flex items-center justify-center">
        <div className="relative w-full" style={{ aspectRatio: '3/4', maxHeight: '100%' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl.current} alt="captured" className="absolute inset-0 w-full h-full object-cover" />

          {/* Ghost overlay for final check */}
          {ghostUrl && showGhost && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ghostUrl} alt="ghost" className="absolute inset-0 w-full h-full object-cover pointer-events-none"
              style={{ opacity: 0.45 }} />
          )}

          {/* Pose + date label */}
          <div className="absolute top-4 left-4 px-3 py-1.5 rounded-lg"
            style={{ background: 'rgba(0,0,0,0.6)', fontFamily: 'monospace', fontSize: '11px', color: 'rgba(255,255,255,0.8)' }}>
            {pose.toUpperCase()} · {new Date().toISOString().split('T')[0]}
          </div>

          {/* Ghost toggle */}
          {ghostUrl && (
            <button onClick={() => setShowGhost(s => !s)}
              className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center active:scale-90"
              style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.2)' }}>
              <span className="text-sm">{showGhost ? '👁' : '👁‍🗨'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Top label */}
      <div className="absolute top-0 left-0 right-0 z-10 text-center pt-12 pb-4"
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)' }}>
        <p className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>
          Review your frame
        </p>
        {ghostUrl && (
          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Tap 👁 to compare with yesterday
          </p>
        )}
      </div>

      {/* Bottom controls */}
      <div className="absolute bottom-0 left-0 right-0 z-10 px-6 pb-10 pt-4"
        style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.9))' }}>
        {error && (
          <p className="text-xs text-center mb-3 px-3 py-2 rounded-lg"
            style={{ background: '#3f1111', color: '#fca5a5' }}>{error}</p>
        )}
        <div className="flex gap-4">
          <button onClick={onRetake} disabled={saving}
            className="flex-1 py-4 rounded-2xl font-bold text-sm active:scale-95 transition-all"
            style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)' }}>
            Retake
          </button>
          <button onClick={save} disabled={saving}
            className="flex-[2] py-4 rounded-2xl font-bold text-sm active:scale-95 transition-all"
            style={{ background: saving ? 'var(--accent-dim)' : 'var(--accent)', color: '#000' }}>
            {saving ? 'Saving…' : 'Save frame ✓'}
          </button>
        </div>
      </div>
    </div>
  )
}
