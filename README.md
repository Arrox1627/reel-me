# REEL ME 🎞️

A daily progress-photo PWA. Every day you get a push notification, open the camera, line up against a translucent ghost of yesterday's shot, snap one frame — and the app compiles all frames into a stop-motion transformation film.

## Features

- **Ghost overlay** — Today's camera feed shows a translucent overlay of your last photo for perfect alignment
- **Pose series** — Track Front, Side, and Back separately; each has its own reel
- **Daily push notifications** — Real Web Push (VAPID), not fake timers
- **Stop-motion reel** — Adjustable FPS, date stamps, scrubber, export to WebM
- **Private storage** — Supabase private bucket with Row Level Security
- **Local-only mode** — IndexedDB storage option, no server uploads
- **Installable PWA** — Add to Home Screen on iOS/Android

## Quick start

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Supabase project

1. Go to supabase.com and create a project
2. Run the SQL migration in Supabase SQL Editor: `supabase/migrations/001_initial_schema.sql`
3. Optionally enable Google OAuth in Authentication → Providers

### 3. Generate VAPID keys

```bash
npx web-push generate-vapid-keys
```

### 4. Configure environment

```bash
cp .env.example .env.local
# Fill in all values
```

### 5. Run

```bash
npm run dev
```

## Deployment (Vercel)

Push to GitHub → import in Vercel → set env vars → deploy. The `vercel.json` cron calls `/api/send-notifications` hourly to dispatch daily reminders.

## Push notifications on iOS

Web Push requires the app to be **installed** (Add to Home Screen) on iOS 16.4+. The app detects this and shows a prompt in Settings.

## Data privacy

- Private Supabase Storage bucket — never public URLs, only short-lived signed URLs
- Row Level Security — users can only access their own rows/files
- Local-only mode keeps everything in IndexedDB on the device
- Delete photo, all photos, or full account + data from Settings

## Note on export format

The reel exports as `.webm` using `canvas + MediaRecorder` — no server round-trip. For `.mp4` output, swap in `ffmpeg.wasm` in `/src/app/(app)/reel/page.tsx`.
