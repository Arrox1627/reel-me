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
  const [ghostOpacity, setGhostOpacity] = useState(38)
  const [showGhost, setShowGhost] = useState(true)
  const [showSilhouette, setShowSilhouette] = useState(true)
  const [permError, setPermError] = useState(false)
  const [flashing, setFlashing] = useState(false)
  const [isCapturing, setIsCapturing] = useState(false)
  const [showSlider, setShowSlider] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    async function loadGhost() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('photos').select('storage_path')
        .eq('user_id', user.id).eq('pose', pose)
        .order('date', { ascending: false }).limit(1).single()
      if (!data) { setGhostUrl(null); return }
      const { data: signed } = await supabase.storage.from('photos')
        .createSignedUrl(data.storage_path, 3600)
      setGhostUrl(signed?.signedUrl ?? null)
    }
    loadGhost()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pose])

  const startCamera = useCallback(async () => {
    try {
      streamRef.current?.getTracks().forEach(t => t.stop())
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, aspectRatio: { ideal: 3 / 4 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
      setPermError(false)
    } catch {
      setPermError(true)
    }
  }, [facingMode])

  useEffect(() => {
    startCamera()
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()) }
  }, [startCamera])

  async function capture() {
    if (isCapturing) return
    setIsCapturing(true)
    setFlashing(true)
    setTimeout(() => setFlashing(false), 450)

    const canvas = canvasRef.current!
    canvas.width = OUTPUT_W; canvas.height = OUTPUT_H
    const ctx = canvas.getContext('2d')!
    const video = videoRef.current!

    const vw = video.videoWidth, vh = video.videoHeight
    const targetRatio = OUTPUT_W / OUTPUT_H
    let sx = 0, sy = 0, sw = vw, sh = vh
    if (vw / vh > targetRatio) { sw = vh * targetRatio; sx = (vw - sw) / 2 }
    else { sh = vw / targetRatio; sy = (vh - sh) / 2 }

    if (facingMode === 'user') { ctx.translate(OUTPUT_W, 0); ctx.scale(-1, 1) }
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, OUTPUT_W, OUTPUT_H)
    if (facingMode === 'user') ctx.setTransform(1, 0, 0, 1, 0, 0)

    canvas.toBlob(blob => { if (blob) onCapture(blob); setIsCapturing(false) }, 'image/jpeg', 0.82)
  }

  if (permError) return <FallbackUpload pose={pose} onPoseChange={onPoseChange} ghostUrl={ghostUrl} onCapture={onCapture} />

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: '#000' }}>
      {/* Flash */}
      {flashing && <div className="absolute inset-0 z-50 pointer-events-none bg-white capture-flash" />}

      {/* Full-bleed camera */}
      <div className="relative flex-1 overflow-hidden">
        <video ref={videoRef} autoPlay playsInline muted
          className="absolute inset-0 w-full h-full object-cover"
          style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }} />

        {/* Photo ghost overlay */}
        {ghostUrl && showGhost && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ghostUrl} alt="ghost"
            className="absolute inset-0 w-full h-full object-cover pointer-events-none ghost-breathe"
            style={{ opacity: ghostOpacity / 100 }} />
        )}

        {/* Human silhouette guide */}
        {showSilhouette && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <HumanSilhouette pose={pose} />
          </div>
        )}

        {/* Viewfinder corners */}
        <div className="vc vc-tl" /><div className="vc vc-tr" />
        <div className="vc vc-bl" /><div className="vc vc-br" />

        {/* Ghost opacity slider — appears on long press of ghost button */}
        {showSlider && ghostUrl && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 z-10">
            <div className="px-2 py-3 rounded-2xl glass flex flex-col items-center gap-2">
              <span className="text-[10px] font-semibold" style={{ color: 'var(--accent)', writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                GHOST {ghostOpacity}%
              </span>
              <input type="range" min={10} max={70} value={ghostOpacity}
                onChange={e => setGhostOpacity(+e.target.value)}
                className="cursor-pointer"
                style={{ writingMode: 'vertical-lr', direction: 'rtl', WebkitAppearance: 'slider-vertical', width: 28, height: 120, accentColor: '#f5a623' } as React.CSSProperties} />
            </div>
          </div>
        )}
      </div>

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 pt-14 pb-4"
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.75), transparent)' }}>
        {/* Pose pills */}
        <div className="flex gap-1 p-1 rounded-2xl"
          style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.12)' }}>
          {POSES.map(p => (
            <button key={p} onClick={() => onPoseChange(p)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all active:scale-90"
              style={{
                background: pose === p ? 'linear-gradient(135deg,#f5a623,#e8960f)' : 'transparent',
                color: pose === p ? '#000' : 'rgba(255,255,255,0.65)',
                boxShadow: pose === p ? '0 2px 8px rgba(245,166,35,0.35)' : 'none',
              }}>
              {p}
            </button>
          ))}
        </div>

        {/* Silhouette toggle */}
        <button onClick={() => setShowSilhouette(s => !s)}
          className="w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-all"
          style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.12)', opacity: showSilhouette ? 1 : 0.45 }}>
          <SilhouetteIcon />
        </button>
      </div>

      {/* Bottom controls */}
      <div className="absolute bottom-0 left-0 right-0 z-20 px-8 pb-12 pt-6"
        style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.85))' }}>
        <div className="flex items-center justify-between">
          {/* Ghost toggle */}
          <button
            onClick={() => { if (!ghostUrl) return; setShowGhost(s => !s) }}
            onContextMenu={e => { e.preventDefault(); if (ghostUrl) setShowSlider(s => !s) }}
            className="w-14 h-14 rounded-full flex flex-col items-center justify-center gap-0.5 active:scale-90 transition-all"
            style={{
              background: (showGhost && ghostUrl) ? 'rgba(245,166,35,0.18)' : 'rgba(255,255,255,0.1)',
              border: `1px solid ${(showGhost && ghostUrl) ? 'rgba(245,166,35,0.4)' : 'rgba(255,255,255,0.15)'}`,
              backdropFilter: 'blur(20px)',
              opacity: ghostUrl ? 1 : 0.35,
            }}>
            <GhostIcon active={showGhost && !!ghostUrl} />
            <span className="text-[8px] font-semibold" style={{ color: (showGhost && ghostUrl) ? 'var(--accent)' : 'rgba(255,255,255,0.5)' }}>
              {ghostUrl ? (showGhost ? 'Ghost' : 'Hidden') : 'No ghost'}
            </span>
          </button>

          {/* Shutter */}
          <button onClick={capture} disabled={isCapturing}
            className="relative flex items-center justify-center active:scale-95 transition-all"
            style={{ width: 76, height: 76 }}>
            <div className="absolute inset-0 rounded-full" style={{ border: '3px solid rgba(255,255,255,0.8)' }} />
            <div className="absolute inset-0 rounded-full transition-all" style={{ background: 'transparent' }} />
            <div className="rounded-full transition-all"
              style={{
                width: 60, height: 60,
                background: isCapturing ? 'linear-gradient(135deg,#f5a623,#e8960f)' : 'white',
                boxShadow: isCapturing ? '0 0 20px rgba(245,166,35,0.6)' : '0 4px 16px rgba(0,0,0,0.4)',
              }} />
          </button>

          {/* Flip */}
          <button onClick={() => setFacingMode(f => f === 'user' ? 'environment' : 'user')}
            className="w-14 h-14 rounded-full flex items-center justify-center active:scale-90 transition-all"
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.15)',
              backdropFilter: 'blur(20px)',
            }}>
            <FlipIcon />
          </button>
        </div>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}

// Human body silhouette guide — scales to fit the 3:4 viewport
function HumanSilhouette({ pose }: { pose: Pose }) {
  const isSide = pose === 'side'
  return (
    <svg
      viewBox="0 0 200 300"
      style={{ width: '52%', height: 'auto', opacity: 0.22, maxHeight: '80%' }}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {isSide ? (
        // Side view silhouette
        <g stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          {/* Head */}
          <ellipse cx="105" cy="28" rx="16" ry="20" />
          {/* Neck */}
          <line x1="105" y1="48" x2="105" y2="60" />
          {/* Torso */}
          <path d="M85 60 Q80 80 82 120 Q84 140 90 150" />
          <path d="M125 60 Q130 80 128 120 Q126 140 118 150" />
          <line x1="85" y1="60" x2="125" y2="60" />
          <line x1="90" y1="150" x2="118" y2="150" />
          {/* Arm front */}
          <path d="M85 65 Q72 90 70 125 Q69 138 72 148" />
          {/* Arm back */}
          <path d="M125 65 Q138 88 136 115 Q135 128 130 138" />
          {/* Legs */}
          <path d="M95 150 Q93 190 92 230 Q91 255 93 280" />
          <path d="M113 150 Q115 190 116 230 Q117 255 115 280" />
          {/* Feet */}
          <path d="M93 280 Q90 284 80 285 Q74 285 72 282" />
          <path d="M115 280 Q114 284 120 285 Q126 285 128 282" />
        </g>
      ) : (
        // Front view silhouette
        <g stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          {/* Head */}
          <ellipse cx="100" cy="28" rx="18" ry="22" />
          {/* Neck */}
          <path d="M92 49 L92 62 M108 49 L108 62" />
          {/* Shoulders */}
          <path d="M92 62 Q75 64 65 72" />
          <path d="M108 62 Q125 64 135 72" />
          {/* Torso sides */}
          <path d="M65 72 Q60 100 63 130 Q65 142 70 152" />
          <path d="M135 72 Q140 100 137 130 Q135 142 130 152" />
          {/* Hips */}
          <path d="M70 152 Q85 158 100 158 Q115 158 130 152" />
          {/* Arms */}
          <path d="M65 72 Q55 100 54 130 Q53 144 56 156" />
          <path d="M135 72 Q145 100 146 130 Q147 144 144 156" />
          {/* Hands */}
          <ellipse cx="56" cy="162" rx="6" ry="9" />
          <ellipse cx="144" cy="162" rx="6" ry="9" />
          {/* Legs */}
          <path d="M85 158 Q83 200 82 235 Q81 258 83 282" />
          <path d="M115 158 Q117 200 118 235 Q119 258 117 282" />
          {/* Feet */}
          <ellipse cx="83" cy="287" rx="12" ry="6" />
          <ellipse cx="117" cy="287" rx="12" ry="6" />
        </g>
      )}
    </svg>
  )
}

function GhostIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke={active ? '#f5a623' : 'rgba(255,255,255,0.7)'} strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M12 3C8.5 3 6 5.8 6 9v10l2-1.5 2 1.5 2-1.5 2 1.5 2-1.5 2 1.5V9c0-3.2-2.5-6-6-6z"/>
      <circle cx="9.5" cy="9.5" r="1" fill={active ? '#f5a623' : 'rgba(255,255,255,0.7)'} stroke="none"/>
      <circle cx="14.5" cy="9.5" r="1" fill={active ? '#f5a623' : 'rgba(255,255,255,0.7)'} stroke="none"/>
    </svg>
  )
}

function FlipIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M1 4v6h6M23 20v-6h-6"/>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15"/>
    </svg>
  )
}

function SilhouetteIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth={1.8}>
      <circle cx="12" cy="5" r="3"/>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
    </svg>
  )
}

function FallbackUpload({ pose, onPoseChange, ghostUrl, onCapture }:
  { pose: Pose; onPoseChange: (p: Pose) => void; ghostUrl: string | null; onCapture: (b: Blob) => void }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPreviewUrl(URL.createObjectURL(file))
    onCapture(file)
  }

  return (
    <div className="min-h-dvh px-5 pt-14" style={{ background: 'var(--bg-base)' }}>
      <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Camera unavailable</h1>
      <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>Upload a photo instead.</p>

      <div className="relative rounded-3xl overflow-hidden mb-5"
        style={{ aspectRatio: '3/4', background: 'rgba(255,255,255,0.05)', border: '1px dashed var(--glass-border)' }}>
        {ghostUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ghostUrl} alt="ghost" className="absolute inset-0 w-full h-full object-cover" style={{ opacity: 0.3 }} />
        )}
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="preview" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <span className="text-4xl">📁</span>
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Tap to select photo</span>
          </div>
        )}
        <label className="absolute inset-0 cursor-pointer">
          <input type="file" accept="image/*" capture="user" className="hidden" onChange={handleFile} />
        </label>
      </div>

      <div className="flex gap-2">
        {POSES.map(p => (
          <button key={p} onClick={() => onPoseChange(p)}
            className="flex-1 py-2.5 rounded-2xl text-xs font-semibold capitalize transition-all active:scale-95"
            style={pose === p
              ? { background: 'linear-gradient(135deg,#f5a623,#e8960f)', color: '#000' }
              : { background: 'rgba(255,255,255,0.07)', color: 'var(--text-secondary)', border: '1px solid var(--glass-border)' }}>
            {p}
          </button>
        ))}
      </div>
    </div>
  )
}
