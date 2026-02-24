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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          details: Json | null
          id: string
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          details?: Json | null
          id?: string
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          target_user_id?: string | null
        }
        Relationships: []
      }
      designs: {
        Row: {
          approved: boolean | null
          file_url: string | null
          id: string
          order_id: string
          order_item_id: string | null
          uploaded_at: string
          version: number
        }
        Insert: {
          approved?: boolean | null
          file_url?: string | null
          id?: string
          order_id: string
          order_item_id?: string | null
          uploaded_at?: string
          version?: number
        }
        Update: {
          approved?: boolean | null
          file_url?: string | null
          id?: string
          order_id?: string
          order_item_id?: string | null
          uploaded_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "designs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "designs_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string
          expense_date: string
          id: string
          notes: string | null
          title: string
        }
        Insert: {
          amount?: number
          category?: string
          created_at?: string
          created_by: string
          expense_date?: string
          id?: string
          notes?: string | null
          title: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string
          expense_date?: string
          id?: string
          notes?: string | null
          title?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          order_id: string | null
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          order_id?: string | null
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          order_id?: string | null
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string | null
          details: Json | null
          id: string
          order_id: string
          status: Database["public"]["Enums"]["order_status"] | null
          template_id: string | null
        }
        Insert: {
          created_at?: string | null
          details?: Json | null
          id?: string
          order_id: string
          status?: Database["public"]["Enums"]["order_status"] | null
          template_id?: string | null
        }
        Update: {
          created_at?: string | null
          details?: Json | null
          id?: string
          order_id?: string
          status?: Database["public"]["Enums"]["order_status"] | null
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          customer_id: string
          designer_id: string | null
          details: Json | null
          id: string
          paid_amount: number
          payment_status: string
          status: Database["public"]["Enums"]["order_status"]
          template_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          designer_id?: string | null
          details?: Json | null
          id?: string
          paid_amount?: number
          payment_status?: string
          status?: Database["public"]["Enums"]["order_status"]
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          designer_id?: string | null
          details?: Json | null
          id?: string
          paid_amount?: number
          payment_status?: string
          status?: Database["public"]["Enums"]["order_status"]
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      otp_attempts: {
        Row: {
          attempts: number
          last_attempt: string | null
          locked_until: string | null
          phone: string
        }
        Insert: {
          attempts?: number
          last_attempt?: string | null
          locked_until?: string | null
          phone: string
        }
        Update: {
          attempts?: number
          last_attempt?: string | null
          locked_until?: string | null
          phone?: string
        }
        Relationships: []
      }
      otp_codes: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          id: string
          phone: string
          used: boolean
        }
        Insert: {
          code: string
          created_at?: string
          expires_at: string
          id?: string
          phone: string
          used?: boolean
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          phone?: string
          used?: boolean
        }
        Relationships: []
      }
      profiles: {
        Row: {
          area: string | null
          created_at: string
          display_name: string | null
          id: string
          is_active: boolean
          is_super_admin: boolean
          landmark: string | null
          last_seen: string | null
          phone: string | null
          province: string | null
          total_time_seconds: number
          updated_at: string
          user_id: string
        }
        Insert: {
          area?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_active?: boolean
          is_super_admin?: boolean
          landmark?: string | null
          last_seen?: string | null
          phone?: string | null
          province?: string | null
          total_time_seconds?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          area?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_active?: boolean
          is_super_admin?: boolean
          landmark?: string | null
          last_seen?: string | null
          phone?: string | null
          province?: string | null
          total_time_seconds?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_addresses: {
        Row: {
          area: string
          created_at: string
          id: string
          is_default: boolean
          label: string
          landmark: string | null
          phone: string
          province: string
          user_id: string
        }
        Insert: {
          area: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          landmark?: string | null
          phone: string
          province: string
          user_id: string
        }
        Update: {
          area?: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          landmark?: string | null
          phone?: string
          province?: string
          user_id?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          cellophane_type: string
          completion_days: number
          cost: number
          created_at: string
          description: string
          icon: string
          icon_url: string | null
          id: string
          label: string
          min_quantity: number
          parent_id: string | null
          price: number
          sort_order: number
        }
        Insert: {
          cellophane_type?: string
          completion_days?: number
          cost?: number
          created_at?: string
          description?: string
          icon?: string
          icon_url?: string | null
          id: string
          label: string
          min_quantity?: number
          parent_id?: string | null
          price?: number
          sort_order?: number
        }
        Update: {
          cellophane_type?: string
          completion_days?: number
          cost?: number
          created_at?: string
          description?: string
          icon?: string
          icon_url?: string | null
          id?: string
          label?: string
          min_quantity?: number
          parent_id?: string | null
          price?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "services_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      specializations: {
        Row: {
          created_at: string
          icon: string
          icon_url: string | null
          id: string
          label: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          icon?: string
          icon_url?: string | null
          id: string
          label: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          icon?: string
          icon_url?: string | null
          id?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          preview_url: string | null
          preview_urls: string[] | null
          price: number | null
          service_type: string
          specializations: string[] | null
          text_fields: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          preview_url?: string | null
          preview_urls?: string[] | null
          price?: number | null
          service_type: string
          specializations?: string[] | null
          text_fields?: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          preview_url?: string | null
          preview_urls?: string[] | null
          price?: number | null
          service_type?: string
          specializations?: string[] | null
          text_fields?: Json
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_customer_names_for_designer: {
        Args: { customer_ids: string[] }
        Returns: {
          display_name: string
          user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "customer" | "designer" | "admin"
      order_status:
        | "draft"
        | "submitted"
        | "assigned"
        | "design_uploaded"
        | "waiting_approval"
        | "approved"
        | "print_ready"
        | "printed"
        | "delivered"
        | "cancelled"
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
      app_role: ["customer", "designer", "admin"],
      order_status: [
        "draft",
        "submitted",
        "assigned",
        "design_uploaded",
        "waiting_approval",
        "approved",
        "print_ready",
        "printed",
        "delivered",
        "cancelled",
      ],
    },
  },
} as const
