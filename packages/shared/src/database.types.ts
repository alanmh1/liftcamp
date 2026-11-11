export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      android_waitlist: {
        Row: {
          created_at: string
          email: string
          id: string
          source: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          source?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          source?: string
        }
        Relationships: []
      }
      app_events: {
        Row: {
          created_at: string
          id: string
          name: string
          props: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          props?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          props?: Json
          user_id?: string
        }
        Relationships: []
      }
      // Hand-added from docs/custom-exercises.sql.
      app_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      app_flags: {
        Row: {
          enabled_for_all: boolean
          flag: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          enabled_for_all?: boolean
          flag: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          enabled_for_all?: boolean
          flag?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      beginner_notes: {
        Row: {
          block_heading: string | null
          created_at: string
          exercise_id: string
          form_breakdown_md: string
          starting_weight_md: string
          substitute_exercise_ids: string[]
          substitution_heading: string
          substitution_md: string
          updated_at: string
        }
        Insert: {
          block_heading?: string | null
          created_at?: string
          exercise_id: string
          form_breakdown_md: string
          starting_weight_md: string
          substitute_exercise_ids?: string[]
          substitution_heading: string
          substitution_md: string
          updated_at?: string
        }
        Update: {
          block_heading?: string | null
          created_at?: string
          exercise_id?: string
          form_breakdown_md?: string
          starting_weight_md?: string
          substitute_exercise_ids?: string[]
          substitution_heading?: string
          substitution_md?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "beginner_notes_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: true
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      exercise_rest_prefs: {
        Row: {
          exercise_id: string
          rest_seconds: number
          updated_at: string
          user_id: string
        }
        Insert: {
          exercise_id: string
          rest_seconds: number
          updated_at?: string
          user_id: string
        }
        Update: {
          exercise_id?: string
          rest_seconds?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_rest_prefs_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_synonym_rules: {
        Row: {
          aliases: string[]
          created_at: string
          id: string
          name_match: string
          note: string | null
        }
        Insert: {
          aliases: string[]
          created_at?: string
          id?: string
          name_match: string
          note?: string | null
        }
        Update: {
          aliases?: string[]
          created_at?: string
          id?: string
          name_match?: string
          note?: string | null
        }
        Relationships: []
      }
      exercises: {
        Row: {
          alias_text: string | null
          all_primary_muscles: string | null
          archived_at: string | null
          category: string
          created_at: string
          description: string | null
          equipment: string | null
          force: string | null
          gif_url: string | null
          gif_url_sm: string | null
          has_incline: boolean
          id: string
          image_url: string | null
          image_url_2: string | null
          is_unilateral: boolean
          level: string | null
          mechanic: string | null
          name: string
          owner_id: string | null
          ppl_day: string | null
          primary_muscle: string | null
          search_all: string | null
          search_text: string | null
          secondary_muscles: string | null
          set_type: string | null
          slug: string
          updated_at: string
          weight_type: string
        }
        Insert: {
          alias_text?: string | null
          all_primary_muscles?: string | null
          archived_at?: string | null
          category?: string
          created_at?: string
          description?: string | null
          equipment?: string | null
          force?: string | null
          gif_url?: string | null
          gif_url_sm?: string | null
          has_incline?: boolean
          id?: string
          image_url?: string | null
          image_url_2?: string | null
          is_unilateral?: boolean
          level?: string | null
          mechanic?: string | null
          name: string
          owner_id?: string | null
          ppl_day?: string | null
          primary_muscle?: string | null
          search_all?: string | null
          search_text?: string | null
          secondary_muscles?: string | null
          set_type?: string | null
          slug: string
          updated_at?: string
          weight_type?: string
        }
        Update: {
          alias_text?: string | null
          all_primary_muscles?: string | null
          archived_at?: string | null
          category?: string
          created_at?: string
          description?: string | null
          equipment?: string | null
          force?: string | null
          gif_url?: string | null
          gif_url_sm?: string | null
          has_incline?: boolean
          id?: string
          image_url?: string | null
          image_url_2?: string | null
          is_unilateral?: boolean
          level?: string | null
          mechanic?: string | null
          name?: string
          owner_id?: string | null
          ppl_day?: string | null
          primary_muscle?: string | null
          search_all?: string | null
          search_text?: string | null
          secondary_muscles?: string | null
          set_type?: string | null
          slug?: string
          updated_at?: string
          weight_type?: string
        }
        Relationships: []
      }
      follows: {
        Row: {
          accepted_at: string | null
          created_at: string
          declined_at: string | null
          followee_id: string
          follower_id: string
          invite_code: string | null
          requested_by: string
          status: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          declined_at?: string | null
          followee_id: string
          follower_id: string
          invite_code?: string | null
          requested_by: string
          status?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          declined_at?: string | null
          followee_id?: string
          follower_id?: string
          invite_code?: string | null
          requested_by?: string
          status?: string
        }
        Relationships: []
      }
      // Hand-added from docs/import-workouts.sql.
      import_exercise_map: {
        Row: {
          close: boolean
          exercise_id: string
          source: string
          source_name: string
        }
        Insert: {
          close?: boolean
          exercise_id: string
          source: string
          source_name: string
        }
        Update: {
          close?: boolean
          exercise_id?: string
          source?: string
          source_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_exercise_map_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      install_events: {
        Row: {
          created_at: string
          device_id: string
          id: string
          name: string
          props: Json
        }
        Insert: {
          created_at?: string
          device_id: string
          id?: string
          name: string
          props?: Json
        }
        Update: {
          created_at?: string
          device_id?: string
          id?: string
          name?: string
          props?: Json
        }
        Relationships: []
      }
      invite_codes: {
        Row: {
          code: string
          created_at: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      kudos: {
        Row: {
          created_at: string
          user_id: string
          workout_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
          workout_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kudos_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      page_views: {
        Row: {
          created_at: string
          device: string | null
          id: string
          is_internal: boolean
          path: string
          referrer_host: string | null
          session_id: string
          user_agent: string | null
          user_id: string | null
          utm_source: string | null
        }
        Insert: {
          created_at?: string
          device?: string | null
          id?: string
          is_internal?: boolean
          path: string
          referrer_host?: string | null
          session_id: string
          user_agent?: string | null
          user_id?: string | null
          utm_source?: string | null
        }
        Update: {
          created_at?: string
          device?: string | null
          id?: string
          is_internal?: boolean
          path?: string
          referrer_host?: string | null
          session_id?: string
          user_agent?: string | null
          user_id?: string | null
          utm_source?: string | null
        }
        Relationships: []
      }
      pr_goals: {
        Row: {
          achieved_at: string | null
          created_at: string
          exercise_id: string
          id: string
          target_weight: number
          user_id: string
        }
        Insert: {
          achieved_at?: string | null
          created_at?: string
          exercise_id: string
          id?: string
          target_weight: number
          user_id: string
        }
        Update: {
          achieved_at?: string | null
          created_at?: string
          exercise_id?: string
          id?: string
          target_weight?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pr_goals_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          id: string
          reason: string
          reporter_id: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          target_user_id: string | null
          target_workout_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          reason: string
          reporter_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          target_user_id?: string | null
          target_workout_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          reporter_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          target_user_id?: string | null
          target_workout_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_target_workout_id_fkey"
            columns: ["target_workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      sets: {
        Row: {
          completed: boolean
          created_at: string
          distance_meters: number | null
          duration_seconds: number | null
          id: string
          incline_percent: number | null
          note: string | null
          position: number
          reps: number | null
          set_type: string | null
          suggested_reps: number | null
          suggested_weight_unit: string | null
          suggested_weight_value: number | null
          suggestion_matched: boolean | null
          user_id: string
          weight: string
          weight_unit: string
          weight_value: number | null
          workout_exercise_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          distance_meters?: number | null
          duration_seconds?: number | null
          id?: string
          incline_percent?: number | null
          note?: string | null
          position?: number
          reps?: number | null
          set_type?: string | null
          suggested_reps?: number | null
          suggested_weight_unit?: string | null
          suggested_weight_value?: number | null
          suggestion_matched?: boolean | null
          user_id: string
          weight?: string
          // Optional by hand: the sets_fill_weight_unit trigger fills it on insert.
          weight_unit?: string
          weight_value?: number | null
          workout_exercise_id: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          distance_meters?: number | null
          duration_seconds?: number | null
          id?: string
          incline_percent?: number | null
          note?: string | null
          position?: number
          reps?: number | null
          set_type?: string | null
          suggested_reps?: number | null
          suggested_weight_unit?: string | null
          suggested_weight_value?: number | null
          suggestion_matched?: boolean | null
          user_id?: string
          weight?: string
          weight_unit?: string
          weight_value?: number | null
          workout_exercise_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sets_workout_exercise_id_fkey"
            columns: ["workout_exercise_id"]
            isOneToOne: false
            referencedRelation: "workout_exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      template_exercises: {
        Row: {
          created_at: string
          exercise_id: string
          id: string
          position: number
          target_reps: string | null
          target_sets: number | null
          template_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          exercise_id: string
          id?: string
          position?: number
          target_reps?: string | null
          target_sets?: number | null
          template_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          exercise_id?: string
          id?: string
          position?: number
          target_reps?: string | null
          target_sets?: number | null
          template_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "template_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_exercises_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          cover_image_url: string | null
          created_at: string
          days_per_week: number | null
          equipment: string | null
          hide_from_onboarding: boolean
          id: string
          in_rotation: boolean
          is_system: boolean
          level: string | null
          name: string
          position: number | null
          program: string | null
          program_blurb: string | null
          program_order: number
          program_slug: string | null
          rotation_position: number | null
          share_token: string | null
          shared_at: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string
          days_per_week?: number | null
          equipment?: string | null
          hide_from_onboarding?: boolean
          id?: string
          in_rotation?: boolean
          is_system?: boolean
          level?: string | null
          name: string
          position?: number | null
          program?: string | null
          program_blurb?: string | null
          program_order?: number
          program_slug?: string | null
          rotation_position?: number | null
          share_token?: string | null
          shared_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string
          days_per_week?: number | null
          equipment?: string | null
          hide_from_onboarding?: boolean
          id?: string
          in_rotation?: boolean
          is_system?: boolean
          level?: string | null
          name?: string
          position?: number | null
          program?: string | null
          program_blurb?: string | null
          program_order?: number
          program_slug?: string | null
          rotation_position?: number | null
          share_token?: string | null
          shared_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_entitlements: {
        Row: {
          expires_at: string | null
          is_pro: boolean
          product_id: string | null
          source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          expires_at?: string | null
          is_pro?: boolean
          product_id?: string | null
          source: string
          updated_at?: string
          user_id: string
        }
        Update: {
          expires_at?: string | null
          is_pro?: boolean
          product_id?: string | null
          source?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_flags: {
        Row: {
          flag: string
          granted_at: string
          granted_by: string | null
          state: string
          user_id: string
        }
        Insert: {
          flag: string
          granted_at?: string
          granted_by?: string | null
          state: string
          user_id: string
        }
        Update: {
          flag?: string
          granted_at?: string
          granted_by?: string | null
          state?: string
          user_id?: string
        }
        Relationships: []
      }
      user_medals: {
        Row: {
          earned_at: string
          earned_week_start: string
          id: string
          user_id: string
          weeks: number
        }
        Insert: {
          earned_at?: string
          earned_week_start: string
          id?: string
          user_id: string
          weeks: number
        }
        Update: {
          earned_at?: string
          earned_week_start?: string
          id?: string
          user_id?: string
          weeks?: number
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          bar_weight: number | null
          birthday: string | null
          bodyweight: number | null
          created_at: string
          equipment_access: string | null
          invited_friend_at: string | null
          plate_inventory: Json | null
          pwa_installed_at: string | null
          progression_rep_trigger: number | null
          setup_hidden_at: string | null
          sex: string | null
          training_level: string | null
          updated_at: string
          user_id: string
          username: string | null
          warmups_enabled: boolean
          weekly_target: number
          weight_unit: string
        }
        Insert: {
          bar_weight?: number | null
          birthday?: string | null
          bodyweight?: number | null
          created_at?: string
          equipment_access?: string | null
          invited_friend_at?: string | null
          plate_inventory?: Json | null
          pwa_installed_at?: string | null
          progression_rep_trigger?: number | null
          setup_hidden_at?: string | null
          sex?: string | null
          training_level?: string | null
          updated_at?: string
          user_id: string
          username?: string | null
          warmups_enabled?: boolean
          weekly_target?: number
          weight_unit?: string
        }
        Update: {
          bar_weight?: number | null
          birthday?: string | null
          bodyweight?: number | null
          created_at?: string
          equipment_access?: string | null
          invited_friend_at?: string | null
          plate_inventory?: Json | null
          pwa_installed_at?: string | null
          progression_rep_trigger?: number | null
          setup_hidden_at?: string | null
          sex?: string | null
          training_level?: string | null
          updated_at?: string
          user_id?: string
          username?: string | null
          warmups_enabled?: boolean
          weekly_target?: number
          weight_unit?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_sources: {
        Row: {
          created_at: string
          detail: string | null
          set_by: string
          source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          detail?: string | null
          set_by?: string
          source: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          detail?: string | null
          set_by?: string
          source?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      workout_exercises: {
        Row: {
          created_at: string
          exercise_id: string
          id: string
          position: number
          user_id: string
          workout_id: string
        }
        Insert: {
          created_at?: string
          exercise_id: string
          id?: string
          position?: number
          user_id: string
          workout_id: string
        }
        Update: {
          created_at?: string
          exercise_id?: string
          id?: string
          position?: number
          user_id?: string
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_exercises_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      workouts: {
        Row: {
          app_version: string | null
          created_at: string
          finished_at: string | null
          id: string
          name: string | null
          notes: string | null
          platform: string | null
          pr_count: number | null
          template_id: string | null
          user_id: string
          workout_date: string
        }
        Insert: {
          app_version?: string | null
          created_at?: string
          finished_at?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          platform?: string | null
          pr_count?: number | null
          template_id?: string | null
          user_id: string
          workout_date?: string
        }
        Update: {
          app_version?: string | null
          created_at?: string
          finished_at?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          platform?: string | null
          pr_count?: number | null
          template_id?: string | null
          user_id?: string
          workout_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "workouts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      page_views_filtered: {
        Row: {
          created_at: string | null
          device: string | null
          filter_reason: string | null
          id: string | null
          path: string | null
          referrer_host: string | null
          session_id: string | null
          user_agent: string | null
        }
        Relationships: []
      }
      page_views_human: {
        Row: {
          created_at: string | null
          device: string | null
          id: string | null
          is_internal: boolean | null
          path: string | null
          referrer_host: string | null
          session_id: string | null
          user_agent: string | null
          user_id: string | null
          utm_source: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_delete_user: {
        Args: { p_confirm_username: string; p_email: string }
        Returns: Json
      }
      // Hand-added from docs/funnel-admin.sql. _since null means the
      // 13 Oct 2026 launch.
      admin_funnel: { Args: { _since?: string | null }; Returns: Json }
      admin_guest_count: { Args: never; Returns: number }
      admin_list_entitlements: {
        Args: never
        Returns: {
          email: string
          expires_at: string
          is_pro: boolean
          source: string
          updated_at: string
          user_id: string
        }[]
      }
      admin_list_flags: {
        Args: { p_flag?: string }
        Returns: {
          email: string
          enabled_for_all: boolean
          granted_at: string
          granted_by: string
          state: string
          user_id: string
        }[]
      }
      admin_list_reports: {
        Args: { p_status?: string }
        Returns: {
          created_at: string
          id: string
          reason: string
          reporter_email: string
          reporter_id: string
          reporter_username: string
          resolved_at: string
          status: string
          target_email: string
          target_user_id: string
          target_username: string
          target_workout_id: string
        }[]
      }
      admin_overview: { Args: { _days?: number }; Returns: Json }
      // Hand-added from docs/funnel-people.sql. _since null returns everyone.
      admin_people: {
        Args: { _since?: string | null }
        Returns: {
          app_version: string | null
          email: string | null
          finished: number
          is_team: boolean
          joined_at: string
          kind: string
          last_seen: string | null
          platform: string | null
          routines: number
          sets_done: number
          source: string | null
          source_detail: string | null
          source_set_by: string | null
          stage: number
          user_id: string
          workouts: number
        }[]
      }
      admin_resolve_report: {
        Args: { p_action: string; p_id: string }
        Returns: string
      }
      admin_routines: {
        Args: { _days?: number; _exclude_internal?: boolean }
        Returns: Json
      }
      admin_set_entitlement: {
        Args: { p_email: string; p_expires_at?: string; p_is_pro: boolean }
        Returns: {
          expires_at: string | null
          is_pro: boolean
          product_id: string | null
          source: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "user_entitlements"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      // Hand-added from docs/custom-exercises.sql.
      admin_list_settings: {
        Args: never
        Returns: { key: string; updated_at: string; updated_by: string | null; value: Json }[]
      }
      admin_set_setting: {
        Args: { p_key: string; p_value: Json }
        Returns: Json
      }
      admin_set_flag: {
        Args: { p_email: string; p_flag: string; p_state: string }
        Returns: string
      }
      admin_set_global_flag: {
        Args: { p_enabled: boolean; p_flag: string }
        Returns: boolean
      }
      // Hand-added from docs/funnel-people.sql. p_source null deletes the row.
      admin_set_source: {
        Args: { p_detail?: string | null; p_source: string | null; p_user_id: string }
        Returns: undefined
      }
      admin_traffic: {
        Args: {
          _anonymous_only?: boolean
          _days?: number
          _exclude_internal?: boolean
        }
        Returns: Json
      }
      admin_user_summary: { Args: { p_email: string }; Returns: Json }
      admin_users: {
        Args: never
        Returns: {
          email: string
          finished: number
          joined_at: string
          last_active: string
          sets: number
          user_id: string
          workouts: number
        }[]
      }
      block_user: { Args: { p_user: string }; Returns: undefined }
      canon_equipment: { Args: { raw: string }; Returns: string }
      canon_muscle: { Args: { raw: string }; Returns: string }
      canon_muscle_list: { Args: { raw: string }; Returns: string }
      current_user_is_admin: { Args: never; Returns: boolean }
      // Hand-added from docs/custom-exercises.sql.
      custom_exercise_status: { Args: never; Returns: Json }
      end_follow: {
        Args: { p_followee: string; p_follower: string }
        Returns: undefined
      }
      exercise_slug: { Args: { raw: string }; Returns: string }
      file_report: {
        Args: {
          p_reason: string
          p_target_user: string
          p_target_workout: string
        }
        Returns: string
      }
      get_shared_template: { Args: { p_token: string }; Returns: Json }
      guest_merge_record: {
        Args: { p_guest: string; p_target: string }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      // Hand-added from docs/import-workouts.sql.
      import_workouts: {
        Args: { p_source: string; p_workouts: Json }
        Returns: { inserted: number; skipped: number }[]
      }
      invite_landing: { Args: { p_code: string }; Returns: { username: string }[] }
      invite_preview: {
        Args: { p_code: string }
        Returns: {
          follows_me: string
          i_follow: string
          user_id: string
          username: string
        }[]
      }
      is_bot_user_agent: { Args: { ua: string }; Returns: boolean }
      list_blocks: {
        Args: never
        Returns: {
          created_at: string
          user_id: string
          username: string
        }[]
      }
      list_follows: {
        Args: never
        Returns: {
          accepted_at: string
          created_at: string
          followee_id: string
          follower_id: string
          other_id: string
          other_username: string
          requested_by: string
          status: string
        }[]
      }
      merge_guest_account: {
        Args: { p_guest: string; p_target: string }
        Returns: Json
      }
      my_invite_code: { Args: never; Returns: string }
      norm_search: { Args: { raw: string }; Returns: string }
      rebuild_exercise_aliases: { Args: never; Returns: number }
      regenerate_invite_code: { Args: never; Returns: string }
      request_follow: {
        Args: { p_code: string; p_direction: string }
        Returns: string
      }
      request_follow_user: { Args: { p_user: string }; Returns: string }
      respond_follow: {
        Args: { p_accept: boolean; p_followee: string; p_follower: string }
        Returns: string
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      pro_launched: { Args: never; Returns: boolean }
      social_access: { Args: never; Returns: boolean }
      set_rotation_order: {
        Args: { ordered_ids: string[] }
        Returns: undefined
      }
      social_feed: {
        Args: { p_before?: string; p_limit?: number }
        Returns: {
          completed_sets: number
          created_at: string
          finished_at: string
          kudos_count: number
          kudos_given: boolean
          name: string
          pr_count: number
          user_id: string
          username: string
          workout_date: string
          workout_id: string
        }[]
      }
      social_profile: {
        Args: { p_user: string }
        Returns: {
          can_view: boolean
          follows_me: string
          i_follow: string
          latest_finished_at: string
          latest_name: string
          latest_workout_id: string
          user_id: string
          username: string
        }[]
      }
      social_streak: {
        Args: { p_user: string }
        Returns: {
          dates: string[]
          weekly_target: number
        }[]
      }
      social_workout: { Args: { p_workout: string }; Returns: Json }
      toggle_kudos: {
        Args: { p_workout: string }
        Returns: {
          given: boolean
          kudos_count: number
        }[]
      }
      unblock_user: { Args: { p_user: string }; Returns: undefined }
      workout_kudos: {
        Args: { p_workout: string }
        Returns: {
          created_at: string
          user_id: string
          username: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
