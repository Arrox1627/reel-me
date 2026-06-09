'use client'

import { useState } from 'react'
import CameraView from '@/components/camera/CameraView'
import ConfirmCapture from '@/components/camera/ConfirmCapture'
import type { Pose } from '@/types/database'

export default function CameraPage() {
  const [captured, setCaptured] = useState<Blob | null>(null)
  const [pose, setPose] = useState<Pose>('front')

  if (captured) {
    return (
      <ConfirmCapture
        blob={captured}
        pose={pose}
        onRetake={() => setCaptured(null)}
      />
    )
  }

  return (
    <CameraView
      pose={pose}
      onPoseChange={setPose}
      onCapture={setCaptured}
    />
  )
}
