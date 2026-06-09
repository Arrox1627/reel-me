'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  { href: '/', label: 'Home', icon: HomeIcon },
  { href: '/camera', label: 'Camera', icon: CameraIcon },
  { href: '/reel', label: 'Reel', icon: ReelIcon },
  { href: '/settings', label: 'Settings', icon: SettingsIcon },
]

export default function BottomNav() {
  const path = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom)',
        background: 'rgba(8,8,16,0.72)',
        backdropFilter: 'blur(32px) saturate(180%)',
        WebkitBackdropFilter: 'blur(32px) saturate(180%)',
        borderTop: '1px solid rgba(255,255,255,0.09)',
      }}>
      <div className="flex items-stretch h-16 px-2">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? path === '/' : path.startsWith(href)
          return (
            <Link key={href} href={href}
              className="flex-1 flex flex-col items-center justify-center gap-1 transition-all active:scale-90 rounded-xl my-1"
              style={{ color: active ? 'var(--accent)' : 'rgba(255,255,255,0.35)' }}>
              <Icon active={active} />
              <span className="text-[10px] font-semibold tracking-wide"
                style={{ color: active ? 'var(--accent)' : 'rgba(255,255,255,0.3)' }}>
                {label}
              </span>
              {active && (
                <span className="absolute bottom-1.5 w-1 h-1 rounded-full" style={{ background: 'var(--accent)' }} />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" fill="none" viewBox="0 0 24 24"
      strokeWidth={active ? 2.2 : 1.7} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline strokeLinecap="round" strokeLinejoin="round" points="9,22 9,12 15,12 15,22"/>
    </svg>
  )
}

function CameraIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" fill="none" viewBox="0 0 24 24"
      strokeWidth={active ? 2.2 : 1.7} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
  )
}

function ReelIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" fill="none" viewBox="0 0 24 24"
      strokeWidth={active ? 2.2 : 1.7} stroke="currentColor">
      <polygon strokeLinecap="round" strokeLinejoin="round" points="23,7 16,12 23,17"/>
      <rect x="1" y="5" width="15" height="14" rx="2"/>
    </svg>
  )
}

function SettingsIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" fill="none" viewBox="0 0 24 24"
      strokeWidth={active ? 2.2 : 1.7} stroke="currentColor">
      <circle cx="12" cy="12" r="3"/>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  )
}
