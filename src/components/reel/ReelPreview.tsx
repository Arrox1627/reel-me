'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Photo } from '@/types/database'
import Link from 'next/link'

interface Props {
  photos: Photo[]
  fps?: number
  autoplay?: boolean
}

export default function ReelPreview({ photos, fps = 4, autoplay = true }: Props) {
  const [urls, setUrls] = useState<string[]>([])
  const [frame, setFrame] = useState(0)
  const [playing, setPlaying] = useState(autoplay)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const supabase = createClient()

  // Load signed URLs for all photos
  useEffect(() => {
    let cancelled = false
    async function load() {
      const signed = await Promise.all(
        photos.map(async (p) => {
          const { data } = await supabase.storage
            .from('photos')
            .createSignedUrl(p.storage_path, 3600)
          return data?.signedUrl ?? ''
        })
      )
      if (!cancelled) setUrls(signed.filter(Boolean))
    }
    if (photos.length > 0) load()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos.map(p => p.id).join(',')])

  const tick = useCallback(() => {
    setFrame(f => (f + 1) % Math.max(1, urls.length))
  }, [urls.length])

  useEffect(() => {
    if (!playing || urls.length <= 1) return
    intervalRef.current = setInterval(tick, 1000 / fps)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [playing, fps, tick, urls.length])

  if (urls.length === 0) return null

  return (
    <div className="relative w-full rounded-2xl overflow-hidden"
      style={{ aspectRatio: '3/4', background: 'var(--bg-elevated)', maxHeight: '55vh' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={urls[frame]}
        alt={`Frame ${frame + 1}`}
        className="w-full h-full object-cover"
        style={{ imageRendering: 'auto' }}
      />

      {/* Overlay controls */}
      <div className="absolute bottom-0 left-0 right-0 px-4 py-3 flex items-center justify-between"
        style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.7))' }}>
        <button onClick={() => setPlaying(p => !p)}
          className="w-10 h-10 rounded-full flex items-center justify-center active:scale-90 transition-all"
          style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)' }}>
          {playing ? (
            <svg width="14" height="14" fill="white" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
            </svg>
          ) : (
            <svg width="14" height="14" fill="white" viewBox="0 0 24 24">
              <polygon points="5,3 19,12 5,21"/>
            </svg>
          )}
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.6)' }}>
            {frame + 1}/{urls.length}
          </span>
          <Link href="/reel"
            className="text-xs font-semibold px-3 py-1.5 rounded-lg active:scale-90 transition-all"
            style={{ background: 'var(--accent)', color: '#000' }}>
            Full reel →
          </Link>
        </div>
      </div>

      {/* Frame counter top-right */}
      <div className="absolute top-3 right-3 px-2 py-1 rounded-lg"
        style={{ background: 'rgba(0,0,0,0.5)', fontSize: '10px', color: 'rgba(255,255,255,0.7)', fontFamily: 'monospace' }}>
        {photos[frame]?.date}
      </div>
    </div>
  )
}
