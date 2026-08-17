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
  public: {
    Tables: {
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
          category: string
          created_at: string
          description: string | null
          equipment: string | null
          force: string | null
          id: string
          image_url: string | null
          image_url_2: string | null
          level: string | null
          mechanic: string | null
          name: string
          ppl_day: string | null
          primary_muscle: string | null
          search_text: string | null
          secondary_muscles: string | null
          slug: string
          weight_type: string
        }
        Insert: {
          alias_text?: string | null
          all_primary_muscles?: string | null
          category?: string
          created_at?: string
          description?: string | null
          equipment?: string | null
          force?: string | null
          id?: string
          image_url?: string | null
          image_url_2?: string | null
          level?: string | null
          mechanic?: string | null
          name: string
          ppl_day?: string | null
          primary_muscle?: string | null
          search_text?: string | null
          secondary_muscles?: string | null
          slug: string
          weight_type?: string
        }
        Update: {
          alias_text?: string | null
          all_primary_muscles?: string | null
          category?: string
          created_at?: string
          description?: string | null
          equipment?: string | null
          force?: string | null
          id?: string
          image_url?: string | null
          image_url_2?: string | null
          level?: string | null
          mechanic?: string | null
          name?: string
          ppl_day?: string | null
          primary_muscle?: string | null
          search_text?: string | null
          secondary_muscles?: string | null
          slug?: string
          weight_type?: string
        }
        Relationships: []
      }
      sets: {
        Row: {
          completed: boolean
          created_at: string
          id: string
          note: string | null
          position: number
          reps: number | null
          user_id: string
          weight: string
          weight_value: number | null
          workout_exercise_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          id?: string
          note?: string | null
          position?: number
          reps?: number | null
          user_id: string
          weight?: string
          weight_value?: number | null
          workout_exercise_id: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          id?: string
          note?: string | null
          position?: number
          reps?: number | null
          user_id?: string
          weight?: string
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
          template_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          exercise_id: string
          id?: string
          position?: number
          template_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          exercise_id?: string
          id?: string
          position?: number
          template_id?: string
          user_id?: string | null
        }
        Relationships: [
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
          created_at: string
          hide_from_onboarding: boolean
          id: string
          is_system: boolean
          name: string
          program: string | null
          program_blurb: string | null
          program_order: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          hide_from_onboarding?: boolean
          id?: string
          is_system?: boolean
          name: string
          program?: string | null
          program_blurb?: string | null
          program_order?: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          hide_from_onboarding?: boolean
          id?: string
          is_system?: boolean
          name?: string
          program?: string | null
          program_blurb?: string | null
          program_order?: number
          user_id?: string | null
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          bodyweight: number | null
          created_at: string
          updated_at: string
          user_id: string
          weekly_target: number
          weight_unit: string
        }
        Insert: {
          bodyweight?: number | null
          created_at?: string
          updated_at?: string
          user_id: string
          weekly_target?: number
          weight_unit?: string
        }
        Update: {
          bodyweight?: number | null
          created_at?: string
          updated_at?: string
          user_id?: string
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
          created_at: string
          finished_at: string | null
          id: string
          name: string | null
          notes: string | null
          user_id: string
          workout_date: string
        }
        Insert: {
          created_at?: string
          finished_at?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          user_id: string
          workout_date?: string
        }
        Update: {
          created_at?: string
          finished_at?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          user_id?: string
          workout_date?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      canon_equipment: { Args: { raw: string }; Returns: string }
      canon_muscle: { Args: { raw: string }; Returns: string }
      canon_muscle_list: { Args: { raw: string }; Returns: string }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      exercise_slug: { Args: { raw: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      norm_search: { Args: { raw: string }; Returns: string }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      rebuild_exercise_aliases: { Args: never; Returns: number }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
