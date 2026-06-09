export type Pose = 'front' | 'side' | 'back'

export interface Profile {
  id: string
  display_name: string | null
  reminder_time: string
  timezone: string
  default_pose: Pose
  notifications_enabled: boolean
  local_only_mode: boolean
  created_at: string
  updated_at: string
}

export interface Photo {
  id: string
  user_id: string
  date: string
  pose: Pose
  storage_path: string
  created_at: string
}

export interface PushSubscription {
  id: string
  user_id: string
  subscription: string
  created_at: string
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: {
          id: string
          display_name?: string | null
          reminder_time?: string
          timezone?: string
          default_pose?: Pose
          notifications_enabled?: boolean
          local_only_mode?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          display_name?: string | null
          reminder_time?: string
          timezone?: string
          default_pose?: Pose
          notifications_enabled?: boolean
          local_only_mode?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      photos: {
        Row: Photo
        Insert: {
          id?: string
          user_id: string
          date: string
          pose?: Pose
          storage_path: string
          created_at?: string
        }
        Update: {
          pose?: Pose
          storage_path?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: PushSubscription
        Insert: {
          id?: string
          user_id: string
          subscription: string
          created_at?: string
        }
        Update: {
          subscription?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
  }
}
