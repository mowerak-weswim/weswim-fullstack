export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      badge_progress: {
        Row: {
          badge_id: string
          current_value: number
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          badge_id: string
          current_value?: number
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          badge_id?: string
          current_value?: number
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "badge_progress_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["badge_id"]
          },
          {
            foreignKeyName: "badge_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      badges: {
        Row: {
          badge_id: string
          category: string
          condition_type: string
          condition_value: number
          icon: string
          label: string
          level: string | null
          master_threshold: number | null
        }
        Insert: {
          badge_id?: string
          category: string
          condition_type: string
          condition_value: number
          icon: string
          label: string
          level?: string | null
          master_threshold?: number | null
        }
        Update: {
          badge_id?: string
          category?: string
          condition_type?: string
          condition_value?: number
          icon?: string
          label?: string
          level?: string | null
          master_threshold?: number | null
        }
        Relationships: []
      }
      comments: {
        Row: {
          comment_id: string
          content: string
          created_at: string | null
          post_id: string
          user_id: string
        }
        Insert: {
          comment_id?: string
          content: string
          created_at?: string | null
          post_id: string
          user_id: string
        }
        Update: {
          comment_id?: string
          content?: string
          created_at?: string | null
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["post_id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      group_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string | null
          role: string | null
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string | null
          role?: string | null
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string | null
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      group_schedules: {
        Row: {
          created_at: string | null
          deadline_at: string | null
          group_id: string
          location: string | null
          schedule_id: string
          scheduled_at: string | null
          status: string
          title: string | null
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          deadline_at?: string | null
          group_id: string
          location?: string | null
          schedule_id?: string
          scheduled_at?: string | null
          status: string
          title?: string | null
          type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          deadline_at?: string | null
          group_id?: string
          location?: string | null
          schedule_id?: string
          scheduled_at?: string | null
          status?: string
          title?: string | null
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_schedules_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_schedules_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string | null
          group_id: string
          level: string
          schedule: Json
          sport_type: string
          status: string | null
          venue_id: string | null
        }
        Insert: {
          created_at?: string | null
          group_id?: string
          level: string
          schedule: Json
          sport_type?: string
          status?: string | null
          venue_id?: string | null
        }
        Update: {
          created_at?: string | null
          group_id?: string
          level?: string
          schedule?: Json
          sport_type?: string
          status?: string | null
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "groups_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["venue_id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          is_read: boolean | null
          message: string | null
          noti_id: string
          ref_id: string | null
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          is_read?: boolean | null
          message?: string | null
          noti_id?: string
          ref_id?: string | null
          type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          is_read?: boolean | null
          message?: string | null
          noti_id?: string
          ref_id?: string | null
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      post_reactions: {
        Row: {
          created_at: string | null
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["post_id"]
          },
          {
            foreignKeyName: "post_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      posts: {
        Row: {
          category: string
          content: string
          created_at: string | null
          group_id: string | null
          post_id: string
          sport_type: string | null
          title: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          category: string
          content: string
          created_at?: string | null
          group_id?: string | null
          post_id?: string
          sport_type?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          category?: string
          content?: string
          created_at?: string | null
          group_id?: string | null
          post_id?: string
          sport_type?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      records: {
        Row: {
          created_at: string | null
          is_public: string | null
          record_data: Json
          record_id: string
          recorded_at: string
          sport_type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          is_public?: string | null
          record_data: Json
          record_id?: string
          recorded_at?: string
          sport_type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          is_public?: string | null
          record_data?: Json
          record_id?: string
          recorded_at?: string
          sport_type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      schedule_rsvps: {
        Row: {
          created_at: string | null
          id: string
          response: string
          schedule_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          response: string
          schedule_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          response?: string
          schedule_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_rsvps_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "group_schedules"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "schedule_rsvps_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      schedule_vote_options: {
        Row: {
          id: string
          label: string
          schedule_id: string
          sort_order: number
        }
        Insert: {
          id?: string
          label: string
          schedule_id: string
          sort_order?: number
        }
        Update: {
          id?: string
          label?: string
          schedule_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "schedule_vote_options_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "group_schedules"
            referencedColumns: ["schedule_id"]
          },
        ]
      }
      schedule_votes: {
        Row: {
          created_at: string | null
          id: string
          option_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          option_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          option_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_votes_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "schedule_vote_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      sport_profiles: {
        Row: {
          created_at: string | null
          level: string | null
          profile_id: string
          sport_type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          level?: string | null
          profile_id?: string
          sport_type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          level?: string | null
          profile_id?: string
          sport_type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sport_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_badge_goals: {
        Row: {
          goal_type: string
          goal_value: number
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          goal_type: string
          goal_value: number
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          goal_type?: string
          goal_value?: number
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badge_goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_badges: {
        Row: {
          badge_id: string
          earned_at: string | null
          earned_count: number
          id: string
          is_master: boolean | null
          last_earned_at: string | null
          streak_count: number
          user_id: string
          verified_by: string | null
        }
        Insert: {
          badge_id: string
          earned_at?: string | null
          earned_count?: number
          id?: string
          is_master?: boolean | null
          last_earned_at?: string | null
          streak_count?: number
          user_id: string
          verified_by?: string | null
        }
        Update: {
          badge_id?: string
          earned_at?: string | null
          earned_count?: number
          id?: string
          is_master?: boolean | null
          last_earned_at?: string | null
          streak_count?: number
          user_id?: string
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["badge_id"]
          },
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string | null
          email: string
          nickname: string
          updated_at: string | null
          user_id: string
          user_type: string | null
          venue_request_total_count: number
        }
        Insert: {
          created_at?: string | null
          email: string
          nickname: string
          updated_at?: string | null
          user_id: string
          user_type?: string | null
          venue_request_total_count?: number
        }
        Update: {
          created_at?: string | null
          email?: string
          nickname?: string
          updated_at?: string | null
          user_id?: string
          user_type?: string | null
          venue_request_total_count?: number
        }
        Relationships: []
      }
      venue_requests: {
        Row: {
          address: string | null
          canonical_key: string
          created_at: string | null
          name: string
          req_id: string
          user_id: string
          venue_id: string
        }
        Insert: {
          address?: string | null
          canonical_key: string
          created_at?: string | null
          name: string
          req_id?: string
          user_id: string
          venue_id: string
        }
        Update: {
          address?: string | null
          canonical_key?: string
          created_at?: string | null
          name?: string
          req_id?: string
          user_id?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "venue_requests_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["venue_id"]
          },
        ]
      }
      venues: {
        Row: {
          activated_at: string | null
          address: string | null
          canonical_key: string | null
          created_at: string | null
          created_by: string | null
          name: string
          region: string | null
          sport_type: string
          status: string | null
          venue_id: string
        }
        Insert: {
          activated_at?: string | null
          address?: string | null
          canonical_key?: string | null
          created_at?: string | null
          created_by?: string | null
          name: string
          region?: string | null
          sport_type?: string
          status?: string | null
          venue_id?: string
        }
        Update: {
          activated_at?: string | null
          address?: string | null
          canonical_key?: string | null
          created_at?: string | null
          created_by?: string | null
          name?: string
          region?: string | null
          sport_type?: string
          status?: string | null
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venues_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

