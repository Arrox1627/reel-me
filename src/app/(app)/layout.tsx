import BottomNav from '@/components/ui/BottomNav'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-dvh" style={{ background: 'var(--bg-base)' }}>
      <main className="flex-1 pb-20">{children}</main>
      <BottomNav />
    </div>
  )
}
