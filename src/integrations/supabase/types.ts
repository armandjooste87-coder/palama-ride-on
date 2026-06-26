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
      chat_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          ride_id: string
          sender_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          ride_id: string
          sender_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          ride_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_documents: {
        Row: {
          admin_note: string | null
          created_at: string
          doc_type: string
          driver_id: string
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          storage_path: string
          updated_at: string
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          doc_type: string
          driver_id: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          storage_path: string
          updated_at?: string
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          doc_type?: string
          driver_id?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          storage_path?: string
          updated_at?: string
        }
        Relationships: []
      }
      driver_locations: {
        Row: {
          driver_id: string
          heading: number | null
          lat: number
          lng: number
          updated_at: string
        }
        Insert: {
          driver_id: string
          heading?: number | null
          lat: number
          lng: number
          updated_at?: string
        }
        Update: {
          driver_id?: string
          heading?: number | null
          lat?: number
          lng?: number
          updated_at?: string
        }
        Relationships: []
      }
      platform_ledger: {
        Row: {
          amount_lsm: number
          created_at: string
          id: string
          kind: string
          ride_id: string
        }
        Insert: {
          amount_lsm: number
          created_at?: string
          id?: string
          kind?: string
          ride_id: string
        }
        Update: {
          amount_lsm?: number
          created_at?: string
          id?: string
          kind?: string
          ride_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_ledger_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          commission_pct: number
          created_at: string
          full_name: string | null
          id: string
          is_driver_online: boolean
          phone: string
          rating: number
          updated_at: string
          vehicle_label: string | null
          vehicle_plate: string | null
          verification_level: string
          wallet_balance: number
        }
        Insert: {
          avatar_url?: string | null
          commission_pct?: number
          created_at?: string
          full_name?: string | null
          id: string
          is_driver_online?: boolean
          phone: string
          rating?: number
          updated_at?: string
          vehicle_label?: string | null
          vehicle_plate?: string | null
          verification_level?: string
          wallet_balance?: number
        }
        Update: {
          avatar_url?: string | null
          commission_pct?: number
          created_at?: string
          full_name?: string | null
          id?: string
          is_driver_online?: boolean
          phone?: string
          rating?: number
          updated_at?: string
          vehicle_label?: string | null
          vehicle_plate?: string | null
          verification_level?: string
          wallet_balance?: number
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ratings: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          ratee_id: string
          rater_id: string
          ride_id: string
          stars: number
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          ratee_id: string
          rater_id: string
          ride_id: string
          stars: number
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          ratee_id?: string
          rater_id?: string
          ride_id?: string
          stars?: number
        }
        Relationships: [
          {
            foreignKeyName: "ratings_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      rides: {
        Row: {
          created_at: string
          distance_km: number
          driver_id: string | null
          dropoff_address: string
          dropoff_lat: number
          dropoff_lng: number
          duration_min: number
          fare_lsm: number
          id: string
          passenger_id: string
          pickup_address: string
          pickup_lat: number
          pickup_lng: number
          ride_type: Database["public"]["Enums"]["ride_type"]
          status: Database["public"]["Enums"]["ride_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          distance_km?: number
          driver_id?: string | null
          dropoff_address: string
          dropoff_lat: number
          dropoff_lng: number
          duration_min?: number
          fare_lsm?: number
          id?: string
          passenger_id: string
          pickup_address: string
          pickup_lat: number
          pickup_lng: number
          ride_type?: Database["public"]["Enums"]["ride_type"]
          status?: Database["public"]["Enums"]["ride_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          distance_km?: number
          driver_id?: string | null
          dropoff_address?: string
          dropoff_lat?: number
          dropoff_lng?: number
          duration_min?: number
          fare_lsm?: number
          id?: string
          passenger_id?: string
          pickup_address?: string
          pickup_lat?: number
          pickup_lng?: number
          ride_type?: Database["public"]["Enums"]["ride_type"]
          status?: Database["public"]["Enums"]["ride_status"]
          updated_at?: string
        }
        Relationships: []
      }
      saved_places: {
        Row: {
          address: string
          created_at: string
          id: string
          label: string
          lat: number
          lng: number
          user_id: string
        }
        Insert: {
          address: string
          created_at?: string
          id?: string
          label: string
          lat: number
          lng: number
          user_id: string
        }
        Update: {
          address?: string
          created_at?: string
          id?: string
          label?: string
          lat?: number
          lng?: number
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
      wallet_transactions: {
        Row: {
          amount_lsm: number
          created_at: string
          description: string | null
          id: string
          ride_id: string | null
          type: Database["public"]["Enums"]["txn_type"]
          user_id: string
        }
        Insert: {
          amount_lsm: number
          created_at?: string
          description?: string | null
          id?: string
          ride_id?: string | null
          type: Database["public"]["Enums"]["txn_type"]
          user_id: string
        }
        Update: {
          amount_lsm?: number
          created_at?: string
          description?: string | null
          id?: string
          ride_id?: string | null
          type?: Database["public"]["Enums"]["txn_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_list_drivers: {
        Args: never
        Returns: {
          approved_docs: number
          commission_pct: number
          full_name: string
          id: string
          pending_docs: number
          phone: string
          rating: number
          total_earnings: number
          verification_level: string
        }[]
      }
      admin_review_document: {
        Args: { _doc_id: string; _note: string; _status: string }
        Returns: undefined
      }
      admin_set_commission: {
        Args: { _driver_id: string; _pct: number }
        Returns: undefined
      }
      admin_set_verification: {
        Args: { _driver_id: string; _level: string }
        Returns: undefined
      }
      bootstrap_admin: { Args: never; Returns: undefined }
      complete_ride_payment: { Args: { _ride_id: string }; Returns: undefined }
      driver_doc_upsert: {
        Args: { _doc_type: string; _storage_path: string }
        Returns: {
          admin_note: string | null
          created_at: string
          doc_type: string
          driver_id: string
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          storage_path: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "driver_documents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_ride_counterpart_profile: {
        Args: { _ride_id: string }
        Returns: {
          avatar_url: string
          full_name: string
          id: string
          phone: string
          rating: number
          vehicle_label: string
          vehicle_plate: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      ride_accept: {
        Args: { _ride_id: string }
        Returns: {
          created_at: string
          distance_km: number
          driver_id: string | null
          dropoff_address: string
          dropoff_lat: number
          dropoff_lng: number
          duration_min: number
          fare_lsm: number
          id: string
          passenger_id: string
          pickup_address: string
          pickup_lat: number
          pickup_lng: number
          ride_type: Database["public"]["Enums"]["ride_type"]
          status: Database["public"]["Enums"]["ride_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "rides"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ride_advance: {
        Args: { _ride_id: string; _to: string }
        Returns: {
          created_at: string
          distance_km: number
          driver_id: string | null
          dropoff_address: string
          dropoff_lat: number
          dropoff_lng: number
          duration_min: number
          fare_lsm: number
          id: string
          passenger_id: string
          pickup_address: string
          pickup_lat: number
          pickup_lng: number
          ride_type: Database["public"]["Enums"]["ride_type"]
          status: Database["public"]["Enums"]["ride_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "rides"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ride_cancel: {
        Args: { _ride_id: string }
        Returns: {
          created_at: string
          distance_km: number
          driver_id: string | null
          dropoff_address: string
          dropoff_lat: number
          dropoff_lng: number
          duration_min: number
          fare_lsm: number
          id: string
          passenger_id: string
          pickup_address: string
          pickup_lat: number
          pickup_lng: number
          ride_type: Database["public"]["Enums"]["ride_type"]
          status: Database["public"]["Enums"]["ride_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "rides"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ride_request: {
        Args: {
          _dropoff_address: string
          _dropoff_lat: number
          _dropoff_lng: number
          _pickup_address: string
          _pickup_lat: number
          _pickup_lng: number
          _ride_type: string
        }
        Returns: {
          created_at: string
          distance_km: number
          driver_id: string | null
          dropoff_address: string
          dropoff_lat: number
          dropoff_lng: number
          duration_min: number
          fare_lsm: number
          id: string
          passenger_id: string
          pickup_address: string
          pickup_lat: number
          pickup_lng: number
          ride_type: Database["public"]["Enums"]["ride_type"]
          status: Database["public"]["Enums"]["ride_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "rides"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ride_settle: { Args: { _ride_id: string }; Returns: undefined }
      wallet_topup: {
        Args: { _amount: number }
        Returns: {
          amount_lsm: number
          created_at: string
          description: string | null
          id: string
          ride_id: string | null
          type: Database["public"]["Enums"]["txn_type"]
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "wallet_transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      wallet_withdraw: {
        Args: { _amount: number }
        Returns: {
          amount_lsm: number
          created_at: string
          description: string | null
          id: string
          ride_id: string | null
          type: Database["public"]["Enums"]["txn_type"]
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "wallet_transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role:
        | "passenger"
        | "driver"
        | "admin"
        | "support"
        | "sales"
        | "super_admin"
      ride_status:
        | "requested"
        | "matched"
        | "arriving"
        | "arrived"
        | "in_progress"
        | "completed"
        | "cancelled"
      ride_type: "palama_x" | "palama_xl" | "premium"
      txn_type:
        | "deposit"
        | "withdrawal"
        | "ride_payment"
        | "ride_earning"
        | "refund"
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
      app_role: [
        "passenger",
        "driver",
        "admin",
        "support",
        "sales",
        "super_admin",
      ],
      ride_status: [
        "requested",
        "matched",
        "arriving",
        "arrived",
        "in_progress",
        "completed",
        "cancelled",
      ],
      ride_type: ["palama_x", "palama_xl", "premium"],
      txn_type: [
        "deposit",
        "withdrawal",
        "ride_payment",
        "ride_earning",
        "refund",
      ],
    },
  },
} as const
