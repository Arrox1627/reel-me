'use client'

import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Pose } from '@/types/database'

interface LocalPhoto {
  id: string
  date: string
  pose: Pose
  blob: Blob
  created_at: string
}

interface ReelMeDB extends DBSchema {
  photos: {
    key: string
    value: LocalPhoto
    indexes: { 'by-date': string; 'by-pose': Pose }
  }
}

let db: IDBPDatabase<ReelMeDB> | null = null

async function getDB() {
  if (!db) {
    db = await openDB<ReelMeDB>('reel-me', 1, {
      upgrade(db) {
        const store = db.createObjectStore('photos', { keyPath: 'id' })
        store.createIndex('by-date', 'date')
        store.createIndex('by-pose', 'pose')
      },
    })
  }
  return db
}

export async function saveLocalPhoto(photo: Omit<LocalPhoto, 'id' | 'created_at'>): Promise<string> {
  const db = await getDB()
  const id = crypto.randomUUID()
  await db.put('photos', { ...photo, id, created_at: new Date().toISOString() })
  return id
}

export async function getLocalPhotos(pose?: Pose): Promise<LocalPhoto[]> {
  const db = await getDB()
  if (pose) {
    return db.getAllFromIndex('photos', 'by-pose', pose)
  }
  return db.getAll('photos')
}

export async function getLocalPhotoByDate(date: string, pose: Pose): Promise<LocalPhoto | undefined> {
  const db = await getDB()
  const all = await db.getAllFromIndex('photos', 'by-date', date)
  return all.find(p => p.pose === pose)
}

export async function deleteLocalPhoto(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('photos', id)
}

export async function clearAllLocalPhotos(): Promise<void> {
  const db = await getDB()
  await db.clear('photos')
}

export async function getLocalPhotoBlob(id: string): Promise<Blob | null> {
  const db = await getDB()
  const photo = await db.get('photos', id)
  return photo?.blob ?? null
}
