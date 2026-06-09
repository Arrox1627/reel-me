export default function OfflinePage() {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-6"
      style={{ background: 'var(--bg-base)' }}>
      <div className="text-5xl mb-4">📵</div>
      <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
        You&apos;re offline
      </h1>
      <p className="text-sm text-center" style={{ color: 'var(--text-muted)' }}>
        REEL ME needs a connection to sync your frames.<br />
        Check your internet and try again.
      </p>
    </main>
  )
}
