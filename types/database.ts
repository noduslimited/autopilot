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
      ai_usage_logs: {
        Row: {
          cost_estimate: number
          created_at: string
          feature: string
          id: string
          org_id: string
          tokens_used: number
        }
        Insert: {
          cost_estimate: number
          created_at?: string
          feature: string
          id?: string
          org_id: string
          tokens_used: number
        }
        Update: {
          cost_estimate?: number
          created_at?: string
          feature?: string
          id?: string
          org_id?: string
          tokens_used?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          ip_address: string | null
          new_values: Json | null
          old_values: Json | null
          org_id: string | null
          record_id: string
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          org_id?: string | null
          record_id: string
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          org_id?: string | null
          record_id?: string
          table_name?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      care_plans: {
        Row: {
          ai_suggested_updates: string | null
          care_needs: Json
          client_id: string
          created_at: string
          id: string
          last_reviewed_at: string | null
          org_id: string
          reviewed_by: string | null
          updated_at: string
          what_we_help_with: string[]
        }
        Insert: {
          ai_suggested_updates?: string | null
          care_needs?: Json
          client_id: string
          created_at?: string
          id?: string
          last_reviewed_at?: string | null
          org_id: string
          reviewed_by?: string | null
          updated_at?: string
          what_we_help_with?: string[]
        }
        Update: {
          ai_suggested_updates?: string | null
          care_needs?: Json
          client_id?: string
          created_at?: string
          id?: string
          last_reviewed_at?: string | null
          org_id?: string
          reviewed_by?: string | null
          updated_at?: string
          what_we_help_with?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "care_plans_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_plans_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_plans_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          additional_risk_notes: string | null
          address: string
          allergies: string[]
          archived_at: string | null
          assigned_carer_id: string | null
          biography: string | null
          care_type: string
          choking_risk: boolean
          client_ref: string
          created_at: string
          date_of_birth: string
          dietary_requirements: string | null
          dnacpr: boolean
          falls_risk: boolean
          first_name: string
          gp_name: string | null
          gp_phone: string | null
          gp_practice: string | null
          id: string
          last_name: string
          mobility_aids: string | null
          nhs_number: string | null
          nok_email: string | null
          nok_messaging_enabled: boolean
          nok_name: string | null
          nok_phone: string | null
          nok_relationship: string | null
          org_id: string
          postcode: string | null
          risk_level: string
          status: string
          updated_at: string
          visit_duration_minutes: number | null
          visit_frequency: string | null
        }
        Insert: {
          additional_risk_notes?: string | null
          address: string
          allergies?: string[]
          archived_at?: string | null
          assigned_carer_id?: string | null
          biography?: string | null
          care_type: string
          choking_risk?: boolean
          client_ref: string
          created_at?: string
          date_of_birth: string
          dietary_requirements?: string | null
          dnacpr?: boolean
          falls_risk?: boolean
          first_name: string
          gp_name?: string | null
          gp_phone?: string | null
          gp_practice?: string | null
          id?: string
          last_name: string
          mobility_aids?: string | null
          nhs_number?: string | null
          nok_email?: string | null
          nok_messaging_enabled?: boolean
          nok_name?: string | null
          nok_phone?: string | null
          nok_relationship?: string | null
          org_id: string
          postcode?: string | null
          risk_level?: string
          status?: string
          updated_at?: string
          visit_duration_minutes?: number | null
          visit_frequency?: string | null
        }
        Update: {
          additional_risk_notes?: string | null
          address?: string
          allergies?: string[]
          archived_at?: string | null
          assigned_carer_id?: string | null
          biography?: string | null
          care_type?: string
          choking_risk?: boolean
          client_ref?: string
          created_at?: string
          date_of_birth?: string
          dietary_requirements?: string | null
          dnacpr?: boolean
          falls_risk?: boolean
          first_name?: string
          gp_name?: string | null
          gp_phone?: string | null
          gp_practice?: string | null
          id?: string
          last_name?: string
          mobility_aids?: string | null
          nhs_number?: string | null
          nok_email?: string | null
          nok_messaging_enabled?: boolean
          nok_name?: string | null
          nok_phone?: string | null
          nok_relationship?: string | null
          org_id?: string
          postcode?: string | null
          risk_level?: string
          status?: string
          updated_at?: string
          visit_duration_minutes?: number | null
          visit_frequency?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_assigned_carer_id_fkey"
            columns: ["assigned_carer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          file_type: string | null
          file_url: string
          id: string
          name: string
          org_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          file_type?: string | null
          file_url: string
          id?: string
          name: string
          org_id: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          file_type?: string | null
          file_url?: string
          id?: string
          name?: string
          org_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      emar_records: {
        Row: {
          administered: boolean
          administered_at: string | null
          administered_by: string
          client_id: string
          created_at: string
          id: string
          medication_id: string
          org_id: string
          reason_detail: string | null
          reason_not_administered: string | null
          visit_id: string
          visit_task_id: string
        }
        Insert: {
          administered: boolean
          administered_at?: string | null
          administered_by: string
          client_id: string
          created_at?: string
          id?: string
          medication_id: string
          org_id: string
          reason_detail?: string | null
          reason_not_administered?: string | null
          visit_id: string
          visit_task_id: string
        }
        Update: {
          administered?: boolean
          administered_at?: string | null
          administered_by?: string
          client_id?: string
          created_at?: string
          id?: string
          medication_id?: string
          org_id?: string
          reason_detail?: string | null
          reason_not_administered?: string | null
          visit_id?: string
          visit_task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "emar_records_administered_by_fkey"
            columns: ["administered_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emar_records_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emar_records_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "medications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emar_records_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emar_records_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emar_records_visit_task_id_fkey"
            columns: ["visit_task_id"]
            isOneToOne: false
            referencedRelation: "visit_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      family_nok: {
        Row: {
          client_id: string
          created_at: string
          id: string
          org_id: string
          relationship: string | null
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          org_id: string
          relationship?: string | null
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          org_id?: string
          relationship?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_nok_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_nok_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_nok_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      id_sequences: {
        Row: {
          created_at: string
          id: string
          next_sequence: number
          org_id: string
          record_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          next_sequence?: number
          org_id: string
          record_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          next_sequence?: number
          org_id?: string
          record_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "id_sequences_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          client_id: string
          created_at: string
          description: string
          gp_contacted: boolean
          gp_notes: string | null
          id: string
          incident_ref: string
          incident_type: string
          manager_notes: string | null
          org_id: string
          reported_by: string
          severity: string
          signed_off_at: string | null
          signed_off_by: string | null
          status: string
          updated_at: string
          visit_id: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          description: string
          gp_contacted?: boolean
          gp_notes?: string | null
          id?: string
          incident_ref: string
          incident_type: string
          manager_notes?: string | null
          org_id: string
          reported_by: string
          severity: string
          signed_off_at?: string | null
          signed_off_by?: string | null
          status?: string
          updated_at?: string
          visit_id?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          description?: string
          gp_contacted?: boolean
          gp_notes?: string | null
          id?: string
          incident_ref?: string
          incident_type?: string
          manager_notes?: string | null
          org_id?: string
          reported_by?: string
          severity?: string
          signed_off_at?: string | null
          signed_off_by?: string | null
          status?: string
          updated_at?: string
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incidents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_signed_off_by_fkey"
            columns: ["signed_off_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          client_id: string
          created_at: string
          created_by: string
          due_date: string | null
          id: string
          invoice_ref: string
          line_items: Json
          org_id: string
          paid_at: string | null
          payment_method: string | null
          sent_at: string | null
          sent_to_email: string | null
          status: string
          subtotal: number
          total_amount: number
          updated_at: string
          vat_amount: number
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by: string
          due_date?: string | null
          id?: string
          invoice_ref: string
          line_items?: Json
          org_id: string
          paid_at?: string | null
          payment_method?: string | null
          sent_at?: string | null
          sent_to_email?: string | null
          status?: string
          subtotal?: number
          total_amount?: number
          updated_at?: string
          vat_amount?: number
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string
          due_date?: string | null
          id?: string
          invoice_ref?: string
          line_items?: Json
          org_id?: string
          paid_at?: string | null
          payment_method?: string | null
          sent_at?: string | null
          sent_to_email?: string | null
          status?: string
          subtotal?: number
          total_amount?: number
          updated_at?: string
          vat_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      medications: {
        Row: {
          active: boolean
          client_id: string
          created_at: string
          dose: string
          frequency: string
          id: string
          medication_name: string
          notes: string | null
          org_id: string
          prescribed_by: string | null
          route: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          client_id: string
          created_at?: string
          dose: string
          frequency: string
          id?: string
          medication_name: string
          notes?: string | null
          org_id: string
          prescribed_by?: string | null
          route?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          client_id?: string
          created_at?: string
          dose?: string
          frequency?: string
          id?: string
          medication_name?: string
          notes?: string | null
          org_id?: string
          prescribed_by?: string | null
          route?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medications_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          client_id: string
          created_at: string
          id: string
          org_id: string
          read_by_family: boolean
          read_by_manager: boolean
          sender_id: string
          sender_name: string
          sender_role: string
        }
        Insert: {
          body: string
          client_id: string
          created_at?: string
          id?: string
          org_id: string
          read_by_family?: boolean
          read_by_manager?: boolean
          sender_id: string
          sender_name: string
          sender_role: string
        }
        Update: {
          body?: string
          client_id?: string
          created_at?: string
          id?: string
          org_id?: string
          read_by_family?: boolean
          read_by_manager?: boolean
          sender_id?: string
          sender_name?: string
          sender_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_dedup_log: {
        Row: {
          id: string
          notification_type: string
          record_id: string
          sent_at: string
          stage: string
        }
        Insert: {
          id?: string
          notification_type: string
          record_id: string
          sent_at?: string
          stage: string
        }
        Update: {
          id?: string
          notification_type?: string
          record_id?: string
          sent_at?: string
          stage?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          link: string | null
          org_id: string
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          link?: string | null
          org_id: string
          read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          link?: string | null
          org_id?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      organisations: {
        Row: {
          active_user_count: number
          address: string | null
          billing_issue_started_at: string | null
          care_types: string[]
          cqc_number: string | null
          created_at: string
          email: string
          id: string
          invoice_account_number: string | null
          invoice_bank_name: string | null
          invoice_company_number: string | null
          invoice_payment_terms: number
          invoice_sort_code: string | null
          invoice_vat_number: string | null
          logo_url: string | null
          name: string
          notification_settings: Json
          org_code: string
          phone: string | null
          status: string
          stripe_customer_id: string | null
          stripe_plan_tier: string | null
          stripe_subscription_id: string | null
          terms_accepted_at: string | null
          terms_accepted_ip: string | null
          trial_end_date: string | null
          trial_start_date: string | null
          updated_at: string
        }
        Insert: {
          active_user_count?: number
          address?: string | null
          billing_issue_started_at?: string | null
          care_types?: string[]
          cqc_number?: string | null
          created_at?: string
          email: string
          id?: string
          invoice_account_number?: string | null
          invoice_bank_name?: string | null
          invoice_company_number?: string | null
          invoice_payment_terms?: number
          invoice_sort_code?: string | null
          invoice_vat_number?: string | null
          logo_url?: string | null
          name: string
          notification_settings?: Json
          org_code: string
          phone?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_plan_tier?: string | null
          stripe_subscription_id?: string | null
          terms_accepted_at?: string | null
          terms_accepted_ip?: string | null
          trial_end_date?: string | null
          trial_start_date?: string | null
          updated_at?: string
        }
        Update: {
          active_user_count?: number
          address?: string | null
          billing_issue_started_at?: string | null
          care_types?: string[]
          cqc_number?: string | null
          created_at?: string
          email?: string
          id?: string
          invoice_account_number?: string | null
          invoice_bank_name?: string | null
          invoice_company_number?: string | null
          invoice_payment_terms?: number
          invoice_sort_code?: string | null
          invoice_vat_number?: string | null
          logo_url?: string | null
          name?: string
          notification_settings?: Json
          org_code?: string
          phone?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_plan_tier?: string | null
          stripe_subscription_id?: string | null
          terms_accepted_at?: string | null
          terms_accepted_ip?: string | null
          trial_end_date?: string | null
          trial_start_date?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          org_id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          org_id: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          org_id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      rota_shifts: {
        Row: {
          assigned_client_ids: string[]
          created_at: string
          end_time: string | null
          id: string
          org_id: string
          recurrence: string
          recurrence_group_id: string | null
          shift_date: string
          shift_type: string
          staff_id: string
          start_time: string | null
          updated_at: string
        }
        Insert: {
          assigned_client_ids?: string[]
          created_at?: string
          end_time?: string | null
          id?: string
          org_id: string
          recurrence?: string
          recurrence_group_id?: string | null
          shift_date: string
          shift_type?: string
          staff_id: string
          start_time?: string | null
          updated_at?: string
        }
        Update: {
          assigned_client_ids?: string[]
          created_at?: string
          end_time?: string | null
          id?: string
          org_id?: string
          recurrence?: string
          recurrence_group_id?: string | null
          shift_date?: string
          shift_type?: string
          staff_id?: string
          start_time?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rota_shifts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rota_shifts_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_reports: {
        Row: {
          content: string
          created_at: string
          generated_by: string
          id: string
          name: string
          org_id: string
          report_type: string
        }
        Insert: {
          content: string
          created_at?: string
          generated_by: string
          id?: string
          name: string
          org_id: string
          report_type?: string
        }
        Update: {
          content?: string
          created_at?: string
          generated_by?: string
          id?: string
          name?: string
          org_id?: string
          report_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_reports_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_reports_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_notification_log: {
        Row: {
          id: string
          sent_at: string
          shift_id: string
          stage: string
        }
        Insert: {
          id?: string
          sent_at?: string
          shift_id: string
          stage: string
        }
        Update: {
          id?: string
          sent_at?: string
          shift_id?: string
          stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_notification_log_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "rota_shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          contract_url: string | null
          created_at: string
          dbs_certificate_url: string | null
          dbs_expiry: string | null
          dbs_number: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          id: string
          org_id: string
          role: string
          staff_ref: string
          start_date: string | null
          updated_at: string
        }
        Insert: {
          contract_url?: string | null
          created_at?: string
          dbs_certificate_url?: string | null
          dbs_expiry?: string | null
          dbs_number?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          id: string
          org_id: string
          role: string
          staff_ref: string
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          contract_url?: string | null
          created_at?: string
          dbs_certificate_url?: string | null
          dbs_expiry?: string | null
          dbs_number?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          id?: string
          org_id?: string
          role?: string
          staff_ref?: string
          start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      training_records: {
        Row: {
          certificate_url: string | null
          completed_date: string
          created_at: string
          expiry_date: string
          id: string
          logged_by: string
          module_label: string
          module_name: string
          org_id: string
          renewal_period_years: number
          staff_id: string
        }
        Insert: {
          certificate_url?: string | null
          completed_date: string
          created_at?: string
          expiry_date: string
          id?: string
          logged_by: string
          module_label: string
          module_name: string
          org_id: string
          renewal_period_years: number
          staff_id: string
        }
        Update: {
          certificate_url?: string | null
          completed_date?: string
          created_at?: string
          expiry_date?: string
          id?: string
          logged_by?: string
          module_label?: string
          module_name?: string
          org_id?: string
          renewal_period_years?: number
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_records_logged_by_fkey"
            columns: ["logged_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_records_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_records_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          first_name: string
          id: string
          last_name: string
          org_id: string
          phone: string | null
          role: string
          status: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          first_name: string
          id: string
          last_name: string
          org_id: string
          phone?: string | null
          role: string
          status?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          org_id?: string
          phone?: string | null
          role?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      visit_tasks: {
        Row: {
          completed: boolean
          completed_at: string | null
          completed_by: string | null
          created_at: string
          id: string
          org_id: string
          requires_emar: boolean
          task_label: string
          task_order: number
          task_type: string
          visit_id: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          org_id: string
          requires_emar?: boolean
          task_label: string
          task_order: number
          task_type: string
          visit_id: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          org_id?: string
          requires_emar?: boolean
          task_label?: string
          task_order?: number
          task_type?: string
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visit_tasks_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_tasks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_tasks_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      visits: {
        Row: {
          assigned_carer_id: string | null
          check_in_time: string | null
          check_out_time: string | null
          client_id: string
          created_at: string
          id: string
          org_id: string
          scheduled_end: string
          scheduled_start: string
          status: string
          tasks_completed: number
          tasks_total: number
          updated_at: string
          visit_notes: string | null
          wellbeing_rating: string | null
        }
        Insert: {
          assigned_carer_id?: string | null
          check_in_time?: string | null
          check_out_time?: string | null
          client_id: string
          created_at?: string
          id?: string
          org_id: string
          scheduled_end: string
          scheduled_start: string
          status?: string
          tasks_completed?: number
          tasks_total?: number
          updated_at?: string
          visit_notes?: string | null
          wellbeing_rating?: string | null
        }
        Update: {
          assigned_carer_id?: string | null
          check_in_time?: string | null
          check_out_time?: string | null
          client_id?: string
          created_at?: string
          id?: string
          org_id?: string
          scheduled_end?: string
          scheduled_start?: string
          status?: string
          tasks_completed?: number
          tasks_total?: number
          updated_at?: string
          visit_notes?: string | null
          wellbeing_rating?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visits_assigned_carer_id_fkey"
            columns: ["assigned_carer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_client_ref: {
        Args: { p_first_name: string; p_last_name: string; p_org_id: string }
        Returns: string
      }
      generate_incident_ref: { Args: { p_org_id: string }; Returns: string }
      generate_invoice_ref: { Args: { p_org_id: string }; Returns: string }
      generate_staff_ref: {
        Args: { p_first_name: string; p_last_name: string; p_org_id: string }
        Returns: string
      }
      get_dbs_expiry_candidates: {
        Args: never
        Returns: {
          days_until_expiry: number
          org_id: string
          record_id: string
          staff_id: string
        }[]
      }
      get_overdue_invoice_candidates: {
        Args: never
        Returns: {
          client_id: string
          invoice_ref: string
          org_id: string
          record_id: string
          total_amount: number
        }[]
      }
      get_shift_notification_candidates: {
        Args: never
        Returns: {
          org_id: string
          seconds_until_start: number
          shift_id: string
          staff_id: string
        }[]
      }
      get_training_expiry_candidates: {
        Args: never
        Returns: {
          days_until_expiry: number
          expiry_date: string
          module_label: string
          org_id: string
          record_id: string
          staff_id: string
        }[]
      }
      get_unassigned_visit_candidates: {
        Args: never
        Returns: {
          client_id: string
          org_id: string
          record_id: string
          scheduled_start: string
        }[]
      }
      get_user_org_id: { Args: never; Returns: string }
      get_user_role: { Args: never; Returns: string }
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
    Enums: {},
  },
} as const
