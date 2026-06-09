'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import { usePhotos, useStreak, hasTodayFrame } from '@/hooks/usePhotos'
import { registerServiceWorker } from '@/lib/push'
import ReelPreview from '@/components/reel/ReelPreview'

export default function HomePage() {
  const { profile, loading: profileLoading } = useProfile()
  const { photos, loading: photosLoading } = usePhotos(profile?.default_pose)
  const streak = useStreak(photos)
  const todayDone = hasTodayFrame(photos)
  const [celebrate, setCelebrate] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  // Register service worker on mount
  useEffect(() => { registerServiceWorker() }, [])

  // Redirect to setup if no profile
  useEffect(() => {
    if (!profileLoading && !profile) {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) router.push('/setup')
        else router.push('/login')
      })
    }
  }, [profile, profileLoading, router, supabase.auth])

  // Milestone celebration
  useEffect(() => {
    const count = photos.length
    if (count > 0 && count % 7 === 0) setCelebrate(true)
    const t = setTimeout(() => setCelebrate(false), 2000)
    return () => clearTimeout(t)
  }, [photos.length])

  if (profileLoading || photosLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="text-2xl font-black" style={{ color: 'var(--accent)' }}>REEL ME</div>
      </div>
    )
  }

  const name = profile?.display_name || 'there'

  return (
    <div className="min-h-dvh px-5 pt-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black" style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
            Hey, {name} 👋
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {todayDone
              ? "You're up to date — great work!"
              : "Today's frame is waiting for you."}
          </p>
        </div>
        {/* Streak badge */}
        {streak > 0 && (
          <div className={`flex flex-col items-center px-3 py-2 rounded-2xl ${celebrate ? 'celebrate' : ''}`}
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
            <span className="streak-fire text-xl">🔥</span>
            <span className="text-xs font-black mt-0.5" style={{ color: 'var(--accent)' }}>{streak}</span>
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>day{streak !== 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      {/* Reel preview / empty state */}
      <div className="mb-6">
        {photos.length > 0 ? (
          <ReelPreview photos={photos} />
        ) : (
          <EmptyState />
        )}
      </div>

      {/* Status + CTA */}
      <div className="mb-6">
        {!todayDone ? (
          <Link href="/camera"
            className={`block w-full py-4 rounded-2xl text-center font-bold text-base active:scale-95 transition-all ${celebrate ? 'celebrate' : ''}`}
            style={{ background: 'var(--accent)', color: '#000' }}>
            📸 Take today&apos;s frame
          </Link>
        ) : (
          <div className="w-full py-4 rounded-2xl text-center font-semibold text-sm"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
            ✓ Frame captured for today
          </div>
        )}
      </div>

      {/* Stats row */}
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <StatCard label="Total frames" value={photos.length} />
          <StatCard label="Day streak" value={`${streak} 🔥`} />
          <StatCard label="Pose" value={(profile?.default_pose || 'front').toUpperCase()} />
        </div>
      )}

      {/* Recent filmstrip */}
      {photos.length > 1 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Recent frames
            </p>
            <Link href="/reel" className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>
              View reel →
            </Link>
          </div>
          <Filmstrip photos={photos.slice(-8).reverse()} />
        </div>
      )}

      {/* Milestone celebration banner */}
      {celebrate && (
        <div className="fixed top-6 left-4 right-4 z-50 py-3 px-4 rounded-2xl text-center font-bold text-sm"
          style={{ background: 'var(--accent)', color: '#000' }}>
          🎬 {photos.length} frames! Keep rolling.
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl p-3 text-center"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      <div className="text-lg font-black" style={{ color: 'var(--text-primary)' }}>{value}</div>
      <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{label}</div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="rounded-2xl py-14 flex flex-col items-center"
      style={{ background: 'var(--bg-surface)', border: '1px dashed var(--border)' }}>
      <div className="text-5xl mb-4">🎞️</div>
      <p className="font-bold text-base mb-1" style={{ color: 'var(--text-primary)' }}>
        Your reel starts here
      </p>
      <p className="text-sm text-center px-8" style={{ color: 'var(--text-muted)' }}>
        Capture your first frame and watch your transformation unfold over time.
      </p>
    </div>
  )
}

function Filmstrip({ photos }: { photos: { id: string; storage_path: string; date: string }[] }) {
  return (
    <div className="flex gap-2 overflow-x-auto filmstrip-scroll pb-2">
      {photos.map(photo => (
        <FilmFrame key={photo.id} photo={photo} />
      ))}
    </div>
  )
}

function FilmFrame({ photo }: { photo: { id: string; storage_path: string; date: string } }) {
  const [url, setUrl] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    supabase.storage.from('photos').createSignedUrl(photo.storage_path, 600)
      .then(({ data }) => setUrl(data?.signedUrl ?? null))
  }, [photo.storage_path, supabase.storage])

  return (
    <div className="relative flex-none w-16 rounded-lg overflow-hidden"
      style={{ aspectRatio: '3/4', background: 'var(--bg-elevated)' }}>
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={photo.date} className="w-full h-full object-cover" />
      )}
      <div className="absolute bottom-0 left-0 right-0 px-1 py-0.5 text-center"
        style={{ background: 'rgba(0,0,0,0.6)', fontSize: '7px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
        {photo.date.slice(5)}
      </div>
    </div>
  )
}
