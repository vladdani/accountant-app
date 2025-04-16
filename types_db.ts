/**
 * This file defines types for your Supabase database tables and their relationships.
 * This allows for type-safe interactions with your database.
 * 
 * You can extend these types as your schema evolves.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      documents: {
        Row: {
          id: string
          uploaded_by: string
          file_path: string | null
          document_url: string | null
          content: string | null
          uploaded_at: string
          original_filename: string | null
          content_tokens: number | null
          vendor: string | null
          document_date: string | null
          document_type: string | null
          total_amount: number | null
          currency: string | null
          processing_time_ms: number | null
          description: string | null
          discount: number | null
          content_hash: string | null
        }
        Insert: {
          id?: string
          uploaded_by: string
          file_path?: string | null
          document_url?: string | null
          content?: string | null
          uploaded_at?: string
          original_filename?: string | null
          content_tokens?: number | null
          vendor?: string | null
          document_date?: string | null
          document_type?: string | null
          total_amount?: number | null
          currency?: string | null
          description?: string | null
          discount?: number | null
          content_hash?: string | null
        }
        Update: {
          id?: string
          uploaded_by?: string
          file_path?: string | null
          document_url?: string | null
          content?: string | null
          uploaded_at?: string
          original_filename?: string | null
          content_tokens?: number | null
          vendor?: string | null
          document_date?: string | null
          document_type?: string | null
          total_amount?: number | null
          currency?: string | null
          processing_time_ms?: number | null
          description?: string | null
          discount?: number | null
          content_hash?: string | null
        }
      }
      subscriptions: {
        Row: {
          id: string
          user_id: string
          status: string
          price_id: string | null
          quantity: number | null
          cancel_at_period_end: boolean | null
          created: string
          current_period_start: string
          current_period_end: string
          ended_at: string | null
          cancel_at: string | null
          canceled_at: string | null
          trial_start: string | null
          trial_end: string | null
        }
        Insert: {
          id: string
          user_id: string
          status: string
          price_id?: string | null
          quantity?: number | null
          cancel_at_period_end?: boolean | null
          created?: string
          current_period_start?: string
          current_period_end?: string
          ended_at?: string | null
          cancel_at?: string | null
          canceled_at?: string | null
          trial_start?: string | null
          trial_end?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          status?: string
          price_id?: string | null
          quantity?: number | null
          cancel_at_period_end?: boolean | null
          created?: string
          current_period_start?: string
          current_period_end?: string
          ended_at?: string | null
          cancel_at?: string | null
          canceled_at?: string | null
          trial_start?: string | null
          trial_end?: string | null
        }
      }
      user_preferences: {
        Row: {
          id: string
          user_id: string
          has_completed_onboarding: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          has_completed_onboarding?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          has_completed_onboarding?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      user_trials: {
        Row: {
          id: string
          user_id: string
          trial_start: string
          trial_end: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          trial_start?: string
          trial_end?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          trial_start?: string
          trial_end?: string
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_distinct_document_types: {
        Args: {
          user_id_param: string
        }
        Returns: { document_type: string }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
} 