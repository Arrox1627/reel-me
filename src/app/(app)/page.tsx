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
  const [justSaved, setJustSaved] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => { registerServiceWorker() }, [])

  useEffect(() => {
    if (!profileLoading && !profile) {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) router.push('/setup')
        else router.push('/login')
      })
    }
  }, [profile, profileLoading, router, supabase.auth])

  useEffect(() => {
    const url = new URLSearchParams(window.location.search)
    if (url.get('saved')) {
      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 3000)
      window.history.replaceState({}, '', '/')
    }
  }, [])

  useEffect(() => {
    if (photos.length > 0 && photos.length % 7 === 0) {
      setCelebrate(true)
      setTimeout(() => setCelebrate(false), 2000)
    }
  }, [photos.length])

  if (profileLoading || photosLoading) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
          style={{ background: 'var(--accent-dim)', border: '1px solid rgba(245,166,35,0.3)' }}>
          <span className="text-lg">🎞️</span>
        </div>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading…</p>
      </div>
    )
  }

  const name = profile?.display_name?.split(' ')[0] || 'there'

  return (
    <div className="min-h-dvh px-4 pt-14 pb-4">
      {/* Background orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] right-[-5%] w-72 h-72 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(245,166,35,0.08) 0%, transparent 70%)', filter: 'blur(40px)' }} />
        {todayDone && (
          <div className="absolute top-[30%] left-[-10%] w-64 h-64 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(52,199,89,0.06) 0%, transparent 70%)', filter: 'blur(50px)' }} />
        )}
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-7 fade-up">
        <div>
          <p className="text-sm mb-0.5" style={{ color: 'var(--text-muted)' }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </p>
          <h1 className="text-2xl font-black tracking-tight" style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
            Hey, {name} 👋
          </h1>
        </div>

        {streak > 0 && (
          <div className={`flex flex-col items-center px-3.5 py-2.5 rounded-2xl ${celebrate ? 'celebrate' : ''}`}
            style={{ background: 'rgba(245,166,35,0.12)', border: '1px solid rgba(245,166,35,0.25)', minWidth: 56 }}>
            <span className="streak-fire text-lg">🔥</span>
            <span className="text-base font-black leading-none mt-0.5" style={{ color: 'var(--accent)' }}>{streak}</span>
            <span className="text-[9px] font-medium mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {streak === 1 ? 'day' : 'days'}
            </span>
          </div>
        )}
      </div>

      {/* Status chip */}
      <div className="mb-4 fade-up" style={{ animationDelay: '0.04s' }}>
        {todayDone ? (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
            style={{ background: 'rgba(52,199,89,0.15)', border: '1px solid rgba(52,199,89,0.25)', color: '#34c759' }}>
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <circle cx="6" cy="6" r="5" fill="#34c759" opacity="0.3"/>
              <path d="M3.5 6l1.8 1.8L8.5 4.5" stroke="#34c759" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Today&apos;s frame saved
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
            style={{ background: 'rgba(245,166,35,0.12)', border: '1px solid rgba(245,166,35,0.25)', color: 'var(--accent)' }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse inline-block" style={{ background: 'var(--accent)' }} />
            Today&apos;s frame is waiting
          </div>
        )}
      </div>

      {/* Reel or empty state */}
      <div className="mb-4 fade-up" style={{ animationDelay: '0.08s' }}>
        {photos.length > 0 ? <ReelPreview photos={photos} /> : <EmptyState />}
      </div>

      {/* CTA */}
      <div className="mb-5 fade-up" style={{ animationDelay: '0.12s' }}>
        {!todayDone ? (
          <Link href="/camera"
            className={`flex items-center justify-center gap-2.5 w-full py-4 rounded-2xl text-sm font-bold btn-accent transition-all ${celebrate ? 'celebrate' : ''}`}>
            <span className="text-base">📸</span>
            Take today&apos;s frame
          </Link>
        ) : (
          <div className="flex items-center justify-center gap-2.5 w-full py-4 rounded-2xl text-sm font-semibold glass"
            style={{ color: 'var(--text-secondary)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <polyline points="20,6 9,17 4,12"/>
            </svg>
            Frame captured for today
          </div>
        )}
      </div>

      {/* Stats row */}
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2.5 mb-5 fade-up" style={{ animationDelay: '0.15s' }}>
          <StatCard label="Total" value={String(photos.length)} icon="🎞️" />
          <StatCard label="Streak" value={`${streak}🔥`} icon="" />
          <StatCard label="Pose" value={(profile?.default_pose || 'front')[0].toUpperCase() + (profile?.default_pose || 'front').slice(1)} icon="" />
        </div>
      )}

      {/* Filmstrip */}
      {photos.length > 1 && (
        <div className="fade-up" style={{ animationDelay: '0.18s' }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Recent
            </p>
            <Link href="/reel" className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>
              View reel →
            </Link>
          </div>
          <Filmstrip photos={photos.slice(-10).reverse()} />
        </div>
      )}

      {/* Saved toast */}
      {justSaved && (
        <div className="fixed top-14 left-4 right-4 z-50 flex items-center justify-center">
          <div className="px-5 py-3 rounded-2xl flex items-center gap-2 text-sm font-semibold glass-bright"
            style={{ color: '#34c759', border: '1px solid rgba(52,199,89,0.3)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <polyline points="20,6 9,17 4,12"/>
            </svg>
            Frame saved!
          </div>
        </div>
      )}

      {/* Milestone banner */}
      {celebrate && (
        <div className="fixed top-14 left-4 right-4 z-50 py-3 px-5 rounded-2xl text-center font-bold text-sm btn-accent">
          🎬 {photos.length} frames! You&apos;re rolling.
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="rounded-2xl p-3 text-center glass">
      {icon && <div className="text-base mb-0.5">{icon}</div>}
      <div className="text-lg font-black leading-tight" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{value}</div>
      <div className="text-[10px] font-medium mt-0.5" style={{ color: 'var(--text-muted)' }}>{label}</div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="rounded-3xl py-14 flex flex-col items-center glass"
      style={{ border: '1px dashed rgba(255,255,255,0.12)' }}>
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: 'rgba(245,166,35,0.1)', border: '1px solid rgba(245,166,35,0.2)' }}>
        <span className="text-2xl">🎞️</span>
      </div>
      <p className="font-bold text-base mb-1.5" style={{ color: 'var(--text-primary)' }}>
        Your reel starts here
      </p>
      <p className="text-sm text-center px-8 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        Capture your first frame and watch your transformation unfold.
      </p>
    </div>
  )
}

function Filmstrip({ photos }: { photos: { id: string; storage_path: string; date: string }[] }) {
  return (
    <div className="flex gap-2 overflow-x-auto filmstrip-scroll pb-2 -mx-1 px-1">
      {photos.map(photo => <FilmFrame key={photo.id} photo={photo} />)}
    </div>
  )
}

function FilmFrame({ photo }: { photo: { id: string; storage_path: string; date: string } }) {
  const [url, setUrl] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    supabase.storage.from('photos').createSignedUrl(photo.storage_path, 600)
      .then(({ data }) => setUrl(data?.signedUrl ?? null))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo.storage_path])

  return (
    <div className="relative flex-none w-[58px] rounded-xl overflow-hidden"
      style={{ aspectRatio: '3/4', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)' }}>
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={photo.date} className="w-full h-full object-cover" />
      )}
      <div className="absolute bottom-0 left-0 right-0 px-1 py-0.5 text-center"
        style={{ background: 'rgba(0,0,0,0.55)', fontSize: '7px', color: 'rgba(255,255,255,0.55)', fontFamily: 'monospace' }}>
        {photo.date.slice(5)}
      </div>
    </div>
  )
}
