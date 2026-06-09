'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Pose } from '@/types/database'

const POSES: Pose[] = ['front', 'side', 'back']
const OUTPUT_W = 720
const OUTPUT_H = 960

interface Props {
  pose: Pose
  onPoseChange: (p: Pose) => void
  onCapture: (blob: Blob) => void
}

export default function CameraView({ pose, onPoseChange, onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user')
  const [ghostUrl, setGhostUrl] = useState<string | null>(null)
  const [ghostOpacity, setGhostOpacity] = useState(40)
  const [showGhost, setShowGhost] = useState(true)
  const [showGrid, setShowGrid] = useState(true)
  const [permError, setPermError] = useState(false)
  const [flashing, setFlashing] = useState(false)
  const [isCapturing, setIsCapturing] = useState(false)
  const supabase = createClient()

  // Load ghost (last photo for this pose)
  useEffect(() => {
    async function loadGhost() {
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
      if (!data) { setGhostUrl(null); return }
      const { data: signed } = await supabase.storage
        .from('photos')
        .createSignedUrl(data.storage_path, 3600)
      setGhostUrl(signed?.signedUrl ?? null)
    }
    loadGhost()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pose])

  // Start camera stream
  const startCamera = useCallback(async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 1280 },
          aspectRatio: { ideal: 3 / 4 },
        },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      setPermError(false)
    } catch {
      setPermError(true)
    }
  }, [facingMode])

  useEffect(() => {
    startCamera()
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()) }
  }, [startCamera])

  function flipCamera() {
    setFacingMode(f => f === 'user' ? 'environment' : 'user')
  }

  async function capture() {
    if (isCapturing) return
    setIsCapturing(true)
    setFlashing(true)
    setTimeout(() => setFlashing(false), 400)

    const canvas = canvasRef.current!
    canvas.width = OUTPUT_W
    canvas.height = OUTPUT_H
    const ctx = canvas.getContext('2d')!
    const video = videoRef.current!

    const vw = video.videoWidth
    const vh = video.videoHeight
    const targetRatio = OUTPUT_W / OUTPUT_H
    const videoRatio = vw / vh

    let sx = 0, sy = 0, sw = vw, sh = vh
    if (videoRatio > targetRatio) {
      sw = vh * targetRatio
      sx = (vw - sw) / 2
    } else {
      sh = vw / targetRatio
      sy = (vh - sh) / 2
    }

    // Mirror if front camera
    if (facingMode === 'user') {
      ctx.translate(OUTPUT_W, 0)
      ctx.scale(-1, 1)
    }
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, OUTPUT_W, OUTPUT_H)
    if (facingMode === 'user') {
      ctx.setTransform(1, 0, 0, 1, 0, 0)
    }

    canvas.toBlob(
      (blob) => {
        if (blob) onCapture(blob)
        setIsCapturing(false)
      },
      'image/jpeg',
      0.72
    )
  }

  if (permError) {
    return <FallbackUpload pose={pose} onPoseChange={onPoseChange} ghostUrl={ghostUrl} onCapture={onCapture} />
  }

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: '#000' }}>
      {/* Camera viewport — 3:4 centered */}
      <div className="relative flex-1 overflow-hidden flex items-center justify-center">
        {/* Flash overlay */}
        {flashing && (
          <div className="absolute inset-0 z-50 pointer-events-none bg-white capture-flash" />
        )}

        {/* Video */}
        <div className="relative w-full" style={{ aspectRatio: '3/4', maxHeight: '100%' }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
            style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
          />

          {/* Ghost overlay */}
          {ghostUrl && showGhost && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={ghostUrl}
              alt="ghost"
              className="absolute inset-0 w-full h-full object-cover pointer-events-none ghost-pulse"
              style={{ opacity: ghostOpacity / 100 }}
            />
          )}

          {/* Grid overlay */}
          {showGrid && <GridOverlay />}

          {/* Viewfinder corners */}
          <div className="vc vc-tl" />
          <div className="vc vc-tr" />
          <div className="vc vc-bl" />
          <div className="vc vc-br" />

          {/* Ghost opacity slider */}
          {ghostUrl && showGhost && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 z-10">
              <span className="text-[9px] rotate-180" style={{ color: 'rgba(255,255,255,0.5)', writingMode: 'vertical-rl' }}>
                GHOST
              </span>
              <input
                type="range"
                min={10}
                max={80}
                value={ghostOpacity}
                onChange={e => setGhostOpacity(+e.target.value)}
                className="w-1 h-32 cursor-pointer accent-amber-400"
                style={{ writingMode: 'vertical-lr', direction: 'rtl', WebkitAppearance: 'slider-vertical' } as React.CSSProperties}
              />
              <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.5)' }}>
                {ghostOpacity}%
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 pt-12 pb-3"
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)' }}>
        {/* Pose selector */}
        <div className="flex gap-1 rounded-xl p-1" style={{ background: 'rgba(0,0,0,0.4)' }}>
          {POSES.map(p => (
            <button key={p} onClick={() => onPoseChange(p)}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition-all active:scale-90"
              style={{
                background: pose === p ? 'var(--accent)' : 'transparent',
                color: pose === p ? '#000' : 'rgba(255,255,255,0.7)',
              }}>
              {p}
            </button>
          ))}
        </div>

        {/* Grid toggle */}
        <button onClick={() => setShowGrid(g => !g)}
          className="w-9 h-9 rounded-full flex items-center justify-center active:scale-90"
          style={{ background: 'rgba(0,0,0,0.4)', opacity: showGrid ? 1 : 0.5 }}>
          <GridIcon />
        </button>
      </div>

      {/* Bottom controls */}
      <div className="absolute bottom-0 left-0 right-0 z-20 flex items-center justify-between px-8 pb-10 pt-4"
        style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.8))' }}>
        {/* Ghost toggle */}
        <button onClick={() => setShowGhost(s => !s)}
          className="w-12 h-12 rounded-full flex items-center justify-center active:scale-90 transition-all"
          style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', opacity: ghostUrl ? 1 : 0.3 }}>
          <GhostIcon active={showGhost && !!ghostUrl} />
        </button>

        {/* Shutter */}
        <button onClick={capture} disabled={isCapturing}
          className="relative flex items-center justify-center active:scale-90 transition-all"
          style={{ width: 72, height: 72 }}>
          <div className="absolute inset-0 rounded-full" style={{ border: '3px solid white' }} />
          <div className="rounded-full" style={{ width: 58, height: 58, background: isCapturing ? 'var(--accent)' : 'white' }} />
        </button>

        {/* Flip camera */}
        <button onClick={flipCamera}
          className="w-12 h-12 rounded-full flex items-center justify-center active:scale-90 transition-all"
          style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }}>
          <FlipIcon />
        </button>
      </div>

      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}

function GridOverlay() {
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 3 4" preserveAspectRatio="none"
      style={{ opacity: 0.25 }}>
      {/* Rule of thirds */}
      <line x1="1" y1="0" x2="1" y2="4" stroke="white" strokeWidth="0.02"/>
      <line x1="2" y1="0" x2="2" y2="4" stroke="white" strokeWidth="0.02"/>
      <line x1="0" y1="1.33" x2="3" y2="1.33" stroke="white" strokeWidth="0.02"/>
      <line x1="0" y1="2.67" x2="3" y2="2.67" stroke="white" strokeWidth="0.02"/>
      {/* Center vertical */}
      <line x1="1.5" y1="0" x2="1.5" y2="4" stroke="#f59e0b" strokeWidth="0.025" opacity="0.8"/>
      {/* Center horizontal tick */}
      <line x1="1.3" y1="2" x2="1.7" y2="2" stroke="#f59e0b" strokeWidth="0.04" opacity="0.8"/>
    </svg>
  )
}

function GhostIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={1.8}
      opacity={active ? 1 : 0.4}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M12 2C8.13 2 5 5.13 5 9v11l2-2 2 2 2-2 2 2 2-2 2 2V9c0-3.87-3.13-7-7-7z"/>
      <circle cx="9" cy="9" r="1" fill="white" stroke="none"/>
      <circle cx="15" cy="9" r="1" fill="white" stroke="none"/>
    </svg>
  )
}

function FlipIcon() {
  return (
    <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M20 7H4M4 7l3-3M4 7l3 3M4 17h16M16 17l3 3M16 17l3-3"/>
    </svg>
  )
}

function GridIcon() {
  return (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={1.8}>
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  )
}

// Fallback upload when camera is not available
function FallbackUpload({
  pose, onPoseChange, ghostUrl, onCapture
}: {
  pose: Pose
  onPoseChange: (p: Pose) => void
  ghostUrl: string | null
  onCapture: (blob: Blob) => void
}) {
  const [draggedUrl, setDraggedUrl] = useState<string | null>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setDraggedUrl(URL.createObjectURL(file))
    onCapture(file)
  }

  return (
    <div className="min-h-dvh flex flex-col px-5 pt-12" style={{ background: 'var(--bg-base)' }}>
      <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Camera unavailable</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
        Upload a photo from your library instead.
      </p>

      <div className="relative rounded-2xl overflow-hidden mb-6" style={{ aspectRatio: '3/4', background: 'var(--bg-elevated)', border: '1px dashed var(--border)' }}>
        {ghostUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ghostUrl} alt="ghost" className="absolute inset-0 w-full h-full object-cover" style={{ opacity: 0.35 }} />
        )}
        {draggedUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={draggedUrl} alt="preview" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <span className="text-4xl">📁</span>
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Tap to select photo</span>
          </div>
        )}
        <label className="absolute inset-0 cursor-pointer">
          <input type="file" accept="image/*" capture="user" className="hidden" onChange={handleFile} />
        </label>
      </div>

      <div className="flex gap-2">
        {(['front', 'side', 'back'] as Pose[]).map(p => (
          <button key={p} onClick={() => onPoseChange(p)}
            className="flex-1 py-2 rounded-xl text-xs font-semibold capitalize"
            style={{ background: pose === p ? 'var(--accent)' : 'var(--bg-elevated)', color: pose === p ? '#000' : 'var(--text-muted)' }}>
            {p}
          </button>
        ))}
      </div>
    </div>
  )
}
