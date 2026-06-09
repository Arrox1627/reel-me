'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Photo, Pose } from '@/types/database'

const POSES: Pose[] = ['front', 'side', 'back']

export default function ReelPage() {
  const [pose, setPose] = useState<Pose>('front')
  const [photos, setPhotos] = useState<Photo[]>([])
  const [urls, setUrls] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingUrls, setLoadingUrls] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      setLoading(true); setUrls([])
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('photos').select('*')
        .eq('user_id', user.id).eq('pose', pose).order('date', { ascending: true })
      setPhotos(data ?? []); setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pose])

  useEffect(() => {
    if (!photos.length) { setUrls([]); return }
    setLoadingUrls(true)
    let cancelled = false
    async function loadUrls() {
      const signed = await Promise.all(photos.map(async p => {
        const { data } = await supabase.storage.from('photos').createSignedUrl(p.storage_path, 7200)
        return data?.signedUrl ?? ''
      }))
      if (!cancelled) { setUrls(signed.filter(Boolean)); setLoadingUrls(false) }
    }
    loadUrls()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos.map(p => p.id).join(',')])

  return (
    <div className="min-h-dvh px-4 pt-12 pb-4">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(245,166,35,0.07) 0%, transparent 70%)', filter: 'blur(50px)' }} />
      </div>

      <div className="flex items-center justify-between mb-6 fade-up">
        <div>
          <h1 className="text-2xl font-black tracking-tight" style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
            Your Reel
          </h1>
          <p className="text-xs mt-0.5 font-mono" style={{ color: 'var(--text-muted)' }}>
            {photos.length} frame{photos.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Pose tabs */}
      <div className="flex gap-2 mb-5 p-1 rounded-2xl fade-up glass"
        style={{ animationDelay: '0.04s' }}>
        {POSES.map(p => (
          <button key={p} onClick={() => setPose(p)}
            className="flex-1 py-2.5 rounded-xl text-xs font-semibold capitalize transition-all active:scale-95"
            style={pose === p
              ? { background: 'linear-gradient(135deg,#f5a623,#e8960f)', color: '#000', boxShadow: '0 2px 12px rgba(245,166,35,0.35)' }
              : { color: 'var(--text-secondary)' }}>
            {p}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</div>
        </div>
      ) : photos.length === 0 ? (
        <div className="flex flex-col items-center py-20 gap-3 fade-up">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--glass-border)' }}>
            <span className="text-2xl">🎞️</span>
          </div>
          <p className="font-bold" style={{ color: 'var(--text-primary)' }}>No {pose} frames yet</p>
          <p className="text-sm text-center" style={{ color: 'var(--text-muted)' }}>
            Capture your first {pose} frame to start this series.
          </p>
        </div>
      ) : (
        <ReelPlayer photos={photos} urls={urls} loading={loadingUrls} />
      )}
    </div>
  )
}

function ReelPlayer({ photos, urls, loading }: { photos: Photo[]; urls: string[]; loading: boolean }) {
  const [frame, setFrame] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [fps, setFps] = useState(4)
  const [showDate, setShowDate] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const total = urls.length

  const tick = useCallback(() => setFrame(f => (f + 1) % Math.max(1, total)), [total])

  useEffect(() => {
    if (!playing || total <= 1) return
    intervalRef.current = setInterval(tick, 1000 / fps)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [playing, fps, tick, total])

  function seek(val: number) { setFrame(val); setPlaying(false) }

  async function exportReel() {
    if (!urls.length || exporting) return
    setExporting(true); setExportProgress(0)
    try {
      const canvas = canvasRef.current!
      const W = 720, H = 960
      canvas.width = W; canvas.height = H
      const ctx = canvas.getContext('2d')!
      const imgs = await Promise.all(urls.map(url => new Promise<HTMLImageElement>((res, rej) => {
        const img = new Image(); img.crossOrigin = 'anonymous'
        img.onload = () => res(img); img.onerror = rej; img.src = url
      })))
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm'
      const stream = canvas.captureStream(fps)
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4_000_000 })
      const chunks: Blob[] = []
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
      await new Promise<void>((resolve, reject) => {
        recorder.onstop = () => resolve(); recorder.onerror = () => reject(new Error('Recording failed'))
        recorder.start()
        let i = 0
        const frameMs = 1000 / fps
        const drawNext = () => {
          if (i >= imgs.length) { recorder.stop(); return }
          const img = imgs[i]
          ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H)
          const ir = img.naturalWidth / img.naturalHeight, cr = W / H
          let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight
          if (ir > cr) { sw = sh * cr; sx = (img.naturalWidth - sw) / 2 }
          else { sh = sw / cr; sy = (img.naturalHeight - sh) / 2 }
          ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H)
          if (showDate && photos[i]) {
            ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, H - 44, W, 44)
            ctx.fillStyle = '#f5f0e8'; ctx.font = 'bold 17px monospace'
            ctx.textAlign = 'center'; ctx.fillText(photos[i].date, W / 2, H - 14)
          }
          setExportProgress(Math.round(((i + 1) / imgs.length) * 100))
          i++; setTimeout(drawNext, frameMs)
        }
        drawNext()
      })
      const videoBlob = new Blob(chunks, { type: mimeType })
      const url = URL.createObjectURL(videoBlob)
      const a = document.createElement('a')
      a.href = url; a.download = `reel-me-${photos[0]?.pose || 'front'}-${Date.now()}.webm`
      a.click(); URL.revokeObjectURL(url)
    } catch (e) { console.error('Export failed:', e) }
    finally { setExporting(false); setExportProgress(0) }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-10 fade-up">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading frames…</p>
      </div>
    )
  }

  return (
    <div className="fade-up">
      {/* Main frame */}
      <div className="relative w-full rounded-3xl overflow-hidden mb-4"
        style={{ aspectRatio: '3/4', background: '#000', maxHeight: '50vh' }}>
        {urls[frame] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={urls[frame]} alt={`Frame ${frame + 1}`} className="w-full h-full object-cover" />
        )}
        {showDate && photos[frame] && (
          <div className="absolute bottom-0 left-0 right-0 py-2 text-center"
            style={{ background: 'rgba(0,0,0,0.55)', fontFamily: 'monospace', fontSize: '12px', color: 'rgba(255,255,255,0.85)' }}>
            {photos[frame].date}
          </div>
        )}
        <div className="absolute top-3 right-3 px-2.5 py-1 rounded-xl"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)', fontFamily: 'monospace', fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>
          {frame + 1} / {total}
        </div>
      </div>

      {/* Scrubber */}
      <div className="mb-4 px-1">
        <input type="range" min={0} max={Math.max(0, total - 1)} value={frame}
          onChange={e => seek(+e.target.value)}
          className="w-full" style={{ accentColor: '#f5a623' }} />
      </div>

      {/* Play controls */}
      <div className="flex items-center gap-2.5 mb-4">
        <button onClick={() => { setFrame(0); setPlaying(false) }}
          className="w-11 h-11 rounded-2xl flex items-center justify-center active:scale-90 glass">
          <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: 'var(--text-secondary)' }}>
            <polygon points="19,20 9,12 19,4"/><line x1="5" y1="19" x2="5" y2="5"/>
          </svg>
        </button>
        <button onClick={() => setPlaying(p => !p)}
          className="flex-1 h-11 rounded-2xl flex items-center justify-center gap-2 font-semibold text-sm active:scale-95 transition-all btn-accent">
          {playing
            ? <><svg width="13" height="13" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>Pause</>
            : <><svg width="13" height="13" fill="currentColor" viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"/></svg>Play</>
          }
        </button>
        <button onClick={() => { setFrame(total - 1); setPlaying(false) }}
          className="w-11 h-11 rounded-2xl flex items-center justify-center active:scale-90 glass">
          <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: 'var(--text-secondary)' }}>
            <polygon points="5,4 15,12 5,20"/><line x1="19" y1="5" x2="19" y2="19"/>
          </svg>
        </button>
      </div>

      {/* Options */}
      <div className="rounded-2xl p-4 mb-4 glass space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Speed</span>
            <span className="text-xs font-mono font-bold" style={{ color: 'var(--accent)' }}>{fps} fps</span>
          </div>
          <input type="range" min={1} max={10} value={fps} onChange={e => setFps(+e.target.value)}
            className="w-full" style={{ accentColor: '#f5a623' }} />
        </div>
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Date stamp</span>
          <GlassToggle checked={showDate} onChange={setShowDate} />
        </label>
      </div>

      {/* Export */}
      <button onClick={exportReel} disabled={exporting || !urls.length}
        className="w-full py-4 rounded-2xl font-semibold text-sm active:scale-95 transition-all flex items-center justify-center gap-2 mb-4 glass"
        style={{ color: 'var(--text-primary)', opacity: (exporting || !urls.length) ? 0.5 : 1 }}>
        {exporting ? (
          <><SpinnerIcon /><span>Exporting… {exportProgress}%</span></>
        ) : (
          <><DownloadIcon />Export reel (.webm)</>
        )}
      </button>

      {/* Filmstrip */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>All frames</p>
        <div className="flex gap-1.5 overflow-x-auto filmstrip-scroll pb-2">
          {urls.map((url, i) => (
            <button key={i} onClick={() => seek(i)}
              className="relative flex-none rounded-xl overflow-hidden active:scale-90 transition-all"
              style={{
                width: 50, aspectRatio: '3/4', background: 'rgba(255,255,255,0.06)',
                outline: frame === i ? '2px solid #f5a623' : 'none',
                outlineOffset: '1px',
              }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="w-full h-full object-cover" />
              <div className="absolute bottom-0 left-0 right-0 text-center"
                style={{ background: 'rgba(0,0,0,0.55)', fontSize: '6px', color: 'rgba(255,255,255,0.65)', fontFamily: 'monospace', padding: '1px 0' }}>
                {photos[i]?.date?.slice(5)}
              </div>
            </button>
          ))}
        </div>
      </div>

      <canvas ref={canvasRef} className="hidden" />
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

function SpinnerIcon() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3"/>
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline strokeLinecap="round" strokeLinejoin="round" points="7,10 12,15 17,10"/>
      <line strokeLinecap="round" x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  )
}
