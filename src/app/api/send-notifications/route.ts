import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import webpush from 'web-push'

// This endpoint is called by Vercel Cron (or any scheduler) hourly.
// It finds users whose reminder time matches their current local time
// and who haven't captured a frame today, then sends push notifications.

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY
  const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:dev@reelme.app'

  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return NextResponse.json({ error: 'VAPID keys not configured' }, { status: 500 })
  }

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const nowUtc = new Date()

  // Get all profiles with notifications enabled that have a subscription
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, reminder_time, timezone, notifications_enabled')
    .eq('notifications_enabled', true)

  if (!profiles?.length) return NextResponse.json({ sent: 0 })

  const userIds = profiles.map(p => p.id)

  // Get their push subscriptions
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('user_id, subscription')
    .in('user_id', userIds)

  const subMap = new Map((subs ?? []).map(s => [s.user_id, s.subscription]))

  // Get today's photos (per user) to skip users who already captured
  const todayResults = await Promise.all(
    profiles.map(async (profile) => {
      // Compute "today" in the user's timezone
      const localDate = new Date(nowUtc.toLocaleString('en-US', { timeZone: profile.timezone || 'UTC' }))
      const todayStr = localDate.toISOString().split('T')[0]
      const localHHMM = `${String(localDate.getHours()).padStart(2, '0')}:${String(localDate.getMinutes()).padStart(2, '0')}`
      const reminderHH = profile.reminder_time?.slice(0, 5) || '08:00'

      // Only notify if within the same hour-minute window (±5 min window)
      const [rH, rM] = reminderHH.split(':').map(Number)
      const [lH, lM] = localHHMM.split(':').map(Number)
      const diffMin = Math.abs((rH * 60 + rM) - (lH * 60 + lM))
      if (diffMin > 5) return null

      // Check if they already have a frame today
      const { data: existing } = await supabase
        .from('photos')
        .select('id')
        .eq('user_id', profile.id)
        .eq('date', todayStr)
        .limit(1)
        .single()

      if (existing) return null  // already captured
      return { userId: profile.id, sub: subMap.get(profile.id) }
    })
  )

  const toNotify = todayResults.filter(Boolean) as { userId: string; sub: string | undefined }[]

  let sent = 0
  const errors: string[] = []

  await Promise.all(
    toNotify.map(async ({ userId, sub }) => {
      if (!sub) return
      try {
        const subscription = JSON.parse(sub) as webpush.PushSubscription
        await webpush.sendNotification(
          subscription,
          JSON.stringify({
            title: 'REEL ME 🎞️',
            body: "Time for today's frame 📸",
            url: '/camera',
          })
        )
        sent++
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        errors.push(`${userId}: ${msg}`)
        // If subscription is invalid/expired, remove it
        if (msg.includes('410') || msg.includes('404')) {
          await supabase.from('push_subscriptions').delete().eq('user_id', userId)
        }
      }
    })
  )

  return NextResponse.json({ sent, skipped: toNotify.length - sent, errors })
}
