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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      assumptions_audit_log: {
        Row: {
          action: string
          changed_fields: Json | null
          created_at: string
          id: string
          new_values: Json | null
          previous_values: Json | null
          snapshot_id: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          changed_fields?: Json | null
          created_at?: string
          id?: string
          new_values?: Json | null
          previous_values?: Json | null
          snapshot_id?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          changed_fields?: Json | null
          created_at?: string
          id?: string
          new_values?: Json | null
          previous_values?: Json | null
          snapshot_id?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assumptions_audit_log_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "assumptions_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      assumptions_snapshots: {
        Row: {
          assumptions: Json
          change_summary: Json | null
          created_at: string
          id: string
          is_active: boolean
          modified_by: string | null
          name: string
          scenario: string
          scope: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          assumptions: Json
          change_summary?: Json | null
          created_at?: string
          id?: string
          is_active?: boolean
          modified_by?: string | null
          name?: string
          scenario?: string
          scope?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          assumptions?: Json
          change_summary?: Json | null
          created_at?: string
          id?: string
          is_active?: boolean
          modified_by?: string | null
          name?: string
          scenario?: string
          scope?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      debt_payment_schedule: {
        Row: {
          cef_pronampe: number
          created_at: string
          guardian: number
          id: string
          karen_debentures: number
          month: string
          municipal_total: number
          paulo_edi: number
          pgfn_total: number
          santander: number
          total_month: number
        }
        Insert: {
          cef_pronampe?: number
          created_at?: string
          guardian?: number
          id?: string
          karen_debentures?: number
          month: string
          municipal_total?: number
          paulo_edi?: number
          pgfn_total?: number
          santander?: number
          total_month?: number
        }
        Update: {
          cef_pronampe?: number
          created_at?: string
          guardian?: number
          id?: string
          karen_debentures?: number
          month?: string
          municipal_total?: number
          paulo_edi?: number
          pgfn_total?: number
          santander?: number
          total_month?: number
        }
        Relationships: []
      }
      financial_debts: {
        Row: {
          category: string
          created_at: string
          creditor: string | null
          id: string
          interest_rate: number | null
          last_payment_date: string | null
          monthly_payment: number | null
          name: string
          next_due_date: string | null
          notes: string | null
          original_amount: number
          outstanding: number
          overdue_amount: number | null
          overdue_installments: number | null
          paid_installments: number | null
          remaining_installments: number | null
          sort_order: number | null
          start_date: string | null
          status: string | null
          total_installments: number | null
          total_paid: number
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          creditor?: string | null
          id?: string
          interest_rate?: number | null
          last_payment_date?: string | null
          monthly_payment?: number | null
          name: string
          next_due_date?: string | null
          notes?: string | null
          original_amount?: number
          outstanding?: number
          overdue_amount?: number | null
          overdue_installments?: number | null
          paid_installments?: number | null
          remaining_installments?: number | null
          sort_order?: number | null
          start_date?: string | null
          status?: string | null
          total_installments?: number | null
          total_paid?: number
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          creditor?: string | null
          id?: string
          interest_rate?: number | null
          last_payment_date?: string | null
          monthly_payment?: number | null
          name?: string
          next_due_date?: string | null
          notes?: string | null
          original_amount?: number
          outstanding?: number
          overdue_amount?: number | null
          overdue_installments?: number | null
          paid_installments?: number | null
          remaining_installments?: number | null
          sort_order?: number | null
          start_date?: string | null
          status?: string | null
          total_installments?: number | null
          total_paid?: number
          updated_at?: string
        }
        Relationships: []
      }
      historical_clients: {
        Row: {
          assumption_key: string
          avg_ticket: number
          category: string
          churn_rate: number
          churned_clients: number
          client_count: number
          client_names: Json | null
          created_at: string
          id: string
          is_mrr: boolean
          period: string
          total_revenue: number
        }
        Insert: {
          assumption_key: string
          avg_ticket?: number
          category: string
          churn_rate?: number
          churned_clients?: number
          client_count?: number
          client_names?: Json | null
          created_at?: string
          id?: string
          is_mrr?: boolean
          period: string
          total_revenue?: number
        }
        Update: {
          assumption_key?: string
          avg_ticket?: number
          category?: string
          churn_rate?: number
          churned_clients?: number
          client_count?: number
          client_names?: Json | null
          created_at?: string
          id?: string
          is_mrr?: boolean
          period?: string
          total_revenue?: number
        }
        Relationships: []
      }
      tax_debts: {
        Row: {
          adhesion_date: string | null
          category: string
          created_at: string
          detail: string | null
          id: string
          items_count: number | null
          monthly_payment: number | null
          note: string | null
          outstanding: number
          sort_order: number | null
          status: string | null
          subcategory: string
          updated_at: string
        }
        Insert: {
          adhesion_date?: string | null
          category: string
          created_at?: string
          detail?: string | null
          id?: string
          items_count?: number | null
          monthly_payment?: number | null
          note?: string | null
          outstanding?: number
          sort_order?: number | null
          status?: string | null
          subcategory: string
          updated_at?: string
        }
        Update: {
          adhesion_date?: string | null
          category?: string
          created_at?: string
          detail?: string | null
          id?: string
          items_count?: number | null
          monthly_payment?: number | null
          note?: string | null
          outstanding?: number
          sort_order?: number | null
          status?: string | null
          subcategory?: string
          updated_at?: string
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
  public: {
    Enums: {},
  },
} as const
