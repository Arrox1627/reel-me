'use client'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
    return reg
  } catch (e) {
    console.warn('SW registration failed:', e)
    return null
  }
}

export async function subscribeToPush(): Promise<void> {
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!vapidKey) return

  const reg = await registerServiceWorker()
  if (!reg) return

  await reg.pushManager.getSubscription().then(s => s?.unsubscribe())

  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as BufferSource,
  })

  await fetch('/api/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription }),
  })
}

export async function unsubscribeFromPush(): Promise<void> {
  const reg = await navigator.serviceWorker?.ready
  if (!reg) return
  const sub = await reg.pushManager.getSubscription()
  if (sub) await sub.unsubscribe()
}

export function isIOS(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent)
}

export function isStandaloneMode(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
}
