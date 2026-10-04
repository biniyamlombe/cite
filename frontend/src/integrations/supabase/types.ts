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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      alert_subscriptions: {
        Row: {
          address_id: string
          created_at: string
          email_enabled: boolean
          id: string
          user_id: string
        }
        Insert: {
          address_id: string
          created_at?: string
          email_enabled?: boolean
          id?: string
          user_id?: string
        }
        Update: {
          address_id?: string
          created_at?: string
          email_enabled?: boolean
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          created_at: string
          id: string
          key_hash: string
          label: string
          last_used_at: string | null
          prefix: string
          revoked_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          key_hash: string
          label: string
          last_used_at?: string | null
          prefix: string
          revoked_at?: string | null
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          key_hash?: string
          label?: string
          last_used_at?: string | null
          prefix?: string
          revoked_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      change_reviews: {
        Row: {
          address_id: string
          change_id: string
          created_at: string
          id: string
          note: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address_id: string
          change_id: string
          created_at?: string
          id?: string
          note?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          address_id?: string
          change_id?: string
          created_at?: string
          id?: string
          note?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      fact_correction_requests: {
        Row: {
          address_id: string
          created_at: string
          explanation: string
          field_name: string
          id: string
          reported_value: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address_id: string
          created_at?: string
          explanation: string
          field_name: string
          id?: string
          reported_value: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          address_id?: string
          created_at?: string
          explanation?: string
          field_name?: string
          id?: string
          reported_value?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      lookup_audit: {
        Row: {
          address_id: string
          as_of: string
          created_at: string
          id: string
          summary: Json
          user_email: string
          user_id: string
        }
        Insert: {
          address_id: string
          as_of: string
          created_at?: string
          id?: string
          summary: Json
          user_email?: string
          user_id?: string
        }
        Update: {
          address_id?: string
          as_of?: string
          created_at?: string
          id?: string
          summary?: Json
          user_email?: string
          user_id?: string
        }
        Relationships: []
      }
      portfolio_groups: {
        Row: {
          address_ids: string[]
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          address_ids?: string[]
          created_at?: string
          id?: string
          name: string
          user_id?: string
        }
        Update: {
          address_ids?: string[]
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      recheck_schedules: {
        Row: {
          address_id: string
          created_at: string
          frequency: string
          id: string
          last_changed: boolean
          last_run_at: string | null
          last_summary: Json | null
          user_id: string
        }
        Insert: {
          address_id: string
          created_at?: string
          frequency?: string
          id?: string
          last_changed?: boolean
          last_run_at?: string | null
          last_summary?: Json | null
          user_id?: string
        }
        Update: {
          address_id?: string
          created_at?: string
          frequency?: string
          id?: string
          last_changed?: boolean
          last_run_at?: string | null
          last_summary?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      review_cases: {
        Row: {
          address_id: string
          as_of: string
          assignee: string
          created_at: string
          evidence_notes: string
          id: string
          questions: string
          snapshot: Json
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address_id: string
          as_of: string
          assignee?: string
          created_at?: string
          evidence_notes?: string
          id?: string
          questions?: string
          snapshot: Json
          status?: string
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          address_id?: string
          as_of?: string
          assignee?: string
          created_at?: string
          evidence_notes?: string
          id?: string
          questions?: string
          snapshot?: Json
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      review_events: {
        Row: {
          action: string
          case_id: string
          created_at: string
          detail: string
          id: string
          user_id: string
        }
        Insert: {
          action: string
          case_id: string
          created_at?: string
          detail?: string
          id?: string
          user_id?: string
        }
        Update: {
          action?: string
          case_id?: string
          created_at?: string
          detail?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_events_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "review_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      rule_comments: {
        Row: {
          author_email: string
          body: string
          created_at: string
          id: string
          team_rule_id: string
          user_id: string
        }
        Insert: {
          author_email?: string
          body: string
          created_at?: string
          id?: string
          team_rule_id: string
          user_id?: string
        }
        Update: {
          author_email?: string
          body?: string
          created_at?: string
          id?: string
          team_rule_id?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_memos: {
        Row: {
          address_id: string
          as_of: string
          created_at: string
          id: string
          note: string | null
          snapshot: Json
          title: string
          user_id: string
        }
        Insert: {
          address_id: string
          as_of: string
          created_at?: string
          id?: string
          note?: string | null
          snapshot: Json
          title: string
          user_id?: string
        }
        Update: {
          address_id?: string
          as_of?: string
          created_at?: string
          id?: string
          note?: string | null
          snapshot?: Json
          title?: string
          user_id?: string
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
      webhooks: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          last_sent_at: string | null
          last_status: number | null
          secret: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          last_sent_at?: string | null
          last_status?: number | null
          secret: string
          url: string
          user_id?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          last_sent_at?: string | null
          last_status?: number | null
          secret?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "member" | "viewer"
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
  public: {
    Enums: {
      app_role: ["admin", "member", "viewer"],
    },
  },
} as const
