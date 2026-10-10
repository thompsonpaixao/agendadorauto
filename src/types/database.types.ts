/**
 * Definições completas de tipos do Banco de Dados PostgreSQL / Supabase
 * Alinhadas à migration 20260916000003_complete_functional_schema.sql
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          name: string | null;
          avatar_url: string | null;
          role: "user" | "developer" | "admin";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          name?: string | null;
          avatar_url?: string | null;
          role?: "user" | "developer" | "admin";
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };

      instagram_accounts: {
        Row: {
          id: string;
          user_id: string;
          instagram_user_id: string;
          username: string;
          name: string | null;
          profile_picture_url: string | null;
          account_type: string | null;
          connection_mode: "development" | "external";
          status: "pending_verification" | "connected" | "reconnect_required" | "error" | "paused" | "disconnected";
          status_message: string | null;
          token_expires_at: string | null;
          last_token_check_at: string | null;
          token_status: "valid" | "expiring_soon" | "invalid" | "unknown";
          has_publish_permission: boolean;
          has_insights_permission: boolean;
          last_verified_at: string | null;
          last_successful_sync_at: string | null;
          last_error_message: string | null;
          followers_count: number;
          media_count: number;
          timezone: string;
          default_reel_caption: string;
          default_carousel_caption: string;
          posts_per_day: number;
          default_post_times: string[];
          default_carousels_per_day?: number;
          default_carousel_post_times?: string[];
          use_random_time_variation: boolean;
          random_variation_minutes: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["instagram_accounts"]["Row"], "id" | "created_at" | "updated_at"> & {
          id?: string;
          default_carousels_per_day?: number;
          default_carousel_post_times?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["instagram_accounts"]["Insert"]>;
      };

      instagram_account_secrets: {
        Row: {
          id: string;
          user_id: string;
          instagram_account_id: string;
          token_encrypted: string;
          token_iv: string;
          token_auth_tag: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["instagram_account_secrets"]["Row"], "id" | "created_at" | "updated_at"> & {
          id?: string;
          token_auth_tag?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["instagram_account_secrets"]["Insert"]>;
      };


      media: {
        Row: {
          id: string;
          user_id: string;
          instagram_account_id: string;
          original_name: string;
          storage_path: string;
          public_url: string;
          thumbnail_url: string | null;
          media_type: "video" | "image";
          size_bytes: number;
          mime_type: string | null;
          duration_seconds: number | null;
          width: number | null;
          height: number | null;
          position: number;
          status: "ready" | "processing" | "uploaded" | "error";
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["media"]["Row"], "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["media"]["Insert"]>;
      };

      reel_queues: {
        Row: {
          id: string;
          user_id: string;
          instagram_account_id: string;
          name: string;
          status: "draft" | "active" | "paused" | "completed" | "cancelled" | "error";
          caption_mode: "profile_default" | "custom_all" | "individual" | "none";
          custom_caption: string;
          posts_per_day: number;
          daily_times: string[];
          use_random_variation: boolean;
          random_variation_minutes: number;
          distribute_until_empty: boolean;
          start_date: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["reel_queues"]["Row"], "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["reel_queues"]["Insert"]>;
      };

      reel_queue_items: {
        Row: {
          id: string;
          user_id: string;
          queue_id: string;
          media_id: string;
          position: number;
          custom_caption: string | null;
          status: "pending" | "scheduled" | "processing" | "published" | "failed" | "cancelled";
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["reel_queue_items"]["Row"], "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["reel_queue_items"]["Insert"]>;
      };

      carousels: {
        Row: {
          id: string;
          user_id: string;
          instagram_account_id: string;
          title: string;
          caption: string;
          status: "draft" | "ready" | "queued" | "scheduled" | "published" | "error";
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["carousels"]["Row"], "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["carousels"]["Insert"]>;
      };

      carousel_items: {
        Row: {
          id: string;
          user_id: string;
          carousel_id: string;
          media_id: string;
          position: number;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["carousel_items"]["Row"], "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["carousel_items"]["Insert"]>;
      };

      schedules: {
        Row: {
          id: string;
          user_id: string;
          instagram_account_id: string;
          name: string;
          timezone: string;
          posts_per_day: number;
          post_times: string[];
          use_random_variation: boolean;
          random_variation_minutes: number;
          active: boolean;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["schedules"]["Row"], "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["schedules"]["Insert"]>;
      };

      scheduled_posts: {
        Row: {
          id: string;
          user_id: string;
          instagram_account_id: string;
          post_type: "reel" | "carousel";
          media_id: string | null;
          carousel_id: string | null;
          queue_id: string | null;
          queue_item_id: string | null;
          caption: string;
          scheduled_at: string;
          status: "scheduled" | "processing" | "published" | "failed" | "cancelled";
          meta_container_id: string | null;
          meta_media_id: string | null;
          locked_at: string | null;
          locked_by: string | null;
          error_code: string | null;
          error_message: string | null;
          retry_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["scheduled_posts"]["Row"], "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["scheduled_posts"]["Insert"]>;
      };

      published_posts: {
        Row: {
          id: string;
          user_id: string;
          instagram_account_id: string;
          scheduled_post_id: string | null;
          media_type: "reel" | "carousel";
          instagram_media_id: string;
          permalink: string | null;
          caption: string;
          published_at: string;
          status: string;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["published_posts"]["Row"], "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["published_posts"]["Insert"]>;
      };

      publication_attempts: {
        Row: {
          id: string;
          user_id: string;
          scheduled_post_id: string;
          attempt_number: number;
          started_at: string;
          finished_at: string | null;
          success: boolean;
          error_code: string | null;
          error_message: string | null;
          retryable: boolean;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["publication_attempts"]["Row"], "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["publication_attempts"]["Insert"]>;
      };

      error_logs: {
        Row: {
          id: string;
          user_id: string;
          instagram_account_id: string | null;
          scheduled_post_id: string | null;
          severity: "warning" | "error" | "critical";
          category: "oauth" | "token" | "upload" | "media_processing" | "publishing" | "storage" | "scheduler" | "analytics" | "database";
          error_code: string;
          message: string;
          technical_details: string | null;
          created_at: string;
          resolved_at: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["error_logs"]["Row"], "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["error_logs"]["Insert"]>;
      };

      notifications: {
        Row: {
          id: string;
          user_id: string;
          instagram_account_id: string | null;
          type: "account_connected" | "account_disconnected" | "token_reconnect_required" | "publish_success" | "publish_failed" | "queue_completed" | "queue_paused";
          title: string;
          message: string;
          read: boolean;
          link: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["notifications"]["Row"], "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["notifications"]["Insert"]>;
      };

      account_metrics: {
        Row: {
          id: string;
          user_id: string;
          instagram_account_id: string;
          date: string;
          followers_count: number;
          media_count: number;
          reach: number | null;
          impressions: number | null;
          profile_views: number | null;
          website_clicks: number | null;
          raw_data: Json | null;
          recorded_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["account_metrics"]["Row"], "id" | "recorded_at"> & {
          id?: string;
          recorded_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["account_metrics"]["Insert"]>;
      };

      media_metrics: {
        Row: {
          id: string;
          user_id: string;
          instagram_account_id: string;
          published_post_id: string | null;
          instagram_media_id: string;
          views: number;
          reach: number;
          likes: number;
          comments: number;
          shares: number;
          saved: number;
          profile_visits: number;
          follows: number;
          watch_time_seconds: number | null;
          avg_watch_time_seconds: number | null;
          raw_data: Json | null;
          recorded_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["media_metrics"]["Row"], "id" | "recorded_at"> & {
          id?: string;
          recorded_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["media_metrics"]["Insert"]>;
      };
    };
  };
}
