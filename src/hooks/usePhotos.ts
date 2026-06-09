'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Photo, Pose } from '@/types/database'

export function usePhotos(pose?: Pose) {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    let query = supabase
      .from('photos')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: true })

    if (pose) query = query.eq('pose', pose)

    const { data } = await query
    setPhotos(data ?? [])
    setLoading(false)
  }, [pose])

  useEffect(() => { refresh() }, [refresh])

  return { photos, loading, refresh }
}

export function useStreak(photos: Photo[]): number {
  if (!photos.length) return 0

  const today = new Date().toISOString().split('T')[0]
  const dates = new Set(photos.map(p => p.date))

  let streak = 0
  let current = new Date()

  while (true) {
    const dateStr = current.toISOString().split('T')[0]
    if (!dates.has(dateStr)) {
      if (dateStr === today) {
        // No frame today yet — still count yesterday's streak
        current.setDate(current.getDate() - 1)
        continue
      }
      break
    }
    streak++
    current.setDate(current.getDate() - 1)
  }

  return streak
}

export function hasTodayFrame(photos: Photo[]): boolean {
  const today = new Date().toISOString().split('T')[0]
  return photos.some(p => p.date === today)
}

export async function getSignedUrl(storagePath: string): Promise<string | null> {
  const supabase = createClient()
  const { data } = await supabase.storage
    .from('photos')
    .createSignedUrl(storagePath, 3600)
  return data?.signedUrl ?? null
}
