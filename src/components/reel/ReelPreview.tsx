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
    <div className="relative w-full rounded-3xl overflow-hidden"
      style={{ aspectRatio: '3/4', background: 'rgba(255,255,255,0.04)', maxHeight: '55vh', border: '1px solid var(--glass-border)' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={urls[frame]}
        alt={`Frame ${frame + 1}`}
        className="w-full h-full object-cover"
      />

      {/* Bottom gradient + controls */}
      <div className="absolute bottom-0 left-0 right-0 px-4 py-4 flex items-center justify-between"
        style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.75))' }}>
        <button onClick={() => setPlaying(p => !p)}
          className="w-10 h-10 rounded-full flex items-center justify-center active:scale-90 transition-all"
          style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.2)' }}>
          {playing ? (
            <svg width="13" height="13" fill="white" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>
            </svg>
          ) : (
            <svg width="13" height="13" fill="white" viewBox="0 0 24 24">
              <polygon points="6,3 20,12 6,21"/>
            </svg>
          )}
        </button>

        <div className="flex items-center gap-2.5">
          <span className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.5)' }}>
            {frame + 1} / {urls.length}
          </span>
          <Link href="/reel"
            className="text-xs font-bold px-3.5 py-1.5 rounded-xl active:scale-90 transition-all btn-accent">
            Full reel →
          </Link>
        </div>
      </div>

      {/* Date badge */}
      <div className="absolute top-3 right-3 px-2.5 py-1 rounded-xl"
        style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(12px)', fontSize: '10px', color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace', border: '1px solid rgba(255,255,255,0.1)' }}>
        {photos[frame]?.date}
      </div>

      {/* Frame indicator dots (for small counts) */}
      {urls.length > 1 && urls.length <= 8 && (
        <div className="absolute top-3 left-3 flex gap-1">
          {urls.map((_, i) => (
            <button key={i} onClick={() => setFrame(i)}
              className="rounded-full transition-all"
              style={{ width: i === frame ? 16 : 5, height: 5, background: i === frame ? 'var(--accent)' : 'rgba(255,255,255,0.3)' }} />
          ))}
        </div>
      )}
    </div>
  )
}
