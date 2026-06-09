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
      if (!user) throw new Error('Not signed in — please reload and try again')

      // Use a fixed path per user/pose/date so retakes overwrite cleanly
      const filename = `${user.id}/${pose}/${today}.jpg`

      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(filename, blob, {
          contentType: 'image/jpeg',
          upsert: true,           // overwrite if retaking same day
          cacheControl: '3600',
        })

      if (uploadError) {
        // Common case: bucket doesn't exist yet
        if (uploadError.message?.includes('Bucket not found') || uploadError.message?.includes('bucket')) {
          throw new Error('Storage bucket not found. Go to Supabase → Storage and create a private bucket named "photos".')
        }
        throw uploadError
      }

      // Upsert the DB row — handles retakes on same day gracefully
      const { error: insertError } = await supabase.from('photos').upsert(
        { user_id: user.id, date: today, pose, storage_path: filename },
        { onConflict: 'user_id,date,pose' }
      )

      if (insertError) throw insertError

      router.push('/?saved=1')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed — check console for details')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: '#000' }}>
      {/* Preview */}
      <div className="relative flex-1 overflow-hidden flex items-center justify-center">
        <div className="relative w-full" style={{ aspectRatio: '3/4', maxHeight: '100%' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl.current} alt="captured"
            className="absolute inset-0 w-full h-full object-cover" />

          {ghostUrl && showGhost && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ghostUrl} alt="ghost"
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
              style={{ opacity: 0.45 }} />
          )}

          {/* Top label */}
          <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-14 pb-4"
            style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)' }}>
            <div>
              <p className="text-white font-semibold text-sm">Review frame</p>
              <p className="text-white/50 text-xs font-mono mt-0.5">
                {pose.toUpperCase()} · {new Date().toISOString().split('T')[0]}
              </p>
            </div>
            {ghostUrl && (
              <button onClick={() => setShowGhost(s => !s)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold active:scale-90 transition-all"
                style={{
                  background: showGhost ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.15)',
                  border: `1px solid ${showGhost ? 'rgba(245,158,11,0.6)' : 'rgba(255,255,255,0.2)'}`,
                  color: showGhost ? '#f59e0b' : 'rgba(255,255,255,0.8)',
                  backdropFilter: 'blur(10px)',
                }}>
                {showGhost ? 'Hide ghost' : 'Compare'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bottom controls */}
      <div className="absolute bottom-0 left-0 right-0 px-6 pb-12 pt-6"
        style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.95))' }}>
        {error && (
          <div className="mb-4 px-4 py-3 rounded-2xl text-xs leading-relaxed"
            style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }}>
            {error}
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={onRetake} disabled={saving}
            className="flex-1 py-4 rounded-2xl font-semibold text-sm active:scale-95 transition-all"
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: 'white',
              backdropFilter: 'blur(20px)',
            }}>
            Retake
          </button>
          <button onClick={save} disabled={saving}
            className="flex-[2] py-4 rounded-2xl font-bold text-sm active:scale-95 transition-all flex items-center justify-center gap-2"
            style={{
              background: saving ? 'rgba(245,158,11,0.6)' : 'linear-gradient(135deg, #f59e0b, #d97706)',
              color: '#000',
              boxShadow: saving ? 'none' : '0 4px 24px rgba(245,158,11,0.35)',
            }}>
            {saving ? (
              <><SpinnerIcon /> Saving…</>
            ) : (
              'Save frame ✓'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function SpinnerIcon() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3"/>
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
    </svg>
  )
}
