export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type FrameworkType =
  | "nextjs"
  | "vite"
  | "react"
  | "astro"
  | "static"
  | "node"
  | "custom";

export type DeploymentStatus =
  | "queued"
  | "initializing"
  | "cloning"
  | "analyzing"
  | "building"
  | "uploading"
  | "deploying"
  | "verifying"
  | "ready"
  | "failed"
  | "cancelled";

export type DeploymentEnvironment = "production" | "preview";
export type TriggerSource = "manual" | "git_push" | "rollback" | "api";
export type StorageProviderType = "local" | "s3" | "supabase";
export type AiProviderType = "gemini" | "openai" | "anthropic" | "openai_compatible";

export interface Database {
  __InternalSupabase: {
    PostgrestVersion: "17.1";
  };
  public: {
    Tables: {
      ai_analyses: {
        Row: {
          analysis_type: string;
          created_at: string;
          deployment_id: string;
          findings: Json;
          id: string;
          project_id: string;
          summary: string;
          user_id: string;
        };
        Insert: {
          analysis_type?: string;
          created_at?: string;
          deployment_id: string;
          findings?: Json;
          id?: string;
          project_id: string;
          summary: string;
          user_id: string;
        };
        Update: {
          analysis_type?: string;
          created_at?: string;
          deployment_id?: string;
          findings?: Json;
          id?: string;
          project_id?: string;
          summary?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      ai_configurations: {
        Row: {
          base_url: string | null;
          created_at: string;
          encrypted_api_key: string | null;
          id: string;
          is_enabled: boolean;
          model: string;
          provider: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          base_url?: string | null;
          created_at?: string;
          encrypted_api_key?: string | null;
          id?: string;
          is_enabled?: boolean;
          model?: string;
          provider?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          base_url?: string | null;
          created_at?: string;
          encrypted_api_key?: string | null;
          id?: string;
          is_enabled?: boolean;
          model?: string;
          provider?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      custom_domains: {
        Row: {
          created_at: string;
          dns_records: Json;
          domain: string;
          id: string;
          last_checked_at: string | null;
          project_id: string;
          ssl_status: string;
          updated_at: string;
          user_id: string;
          verification_status: string;
          verification_token: string;
          verified_at: string | null;
        };
        Insert: {
          created_at?: string;
          dns_records?: Json;
          domain: string;
          id?: string;
          last_checked_at?: string | null;
          project_id: string;
          ssl_status?: string;
          updated_at?: string;
          user_id: string;
          verification_status?: string;
          verification_token: string;
          verified_at?: string | null;
        };
        Update: {
          created_at?: string;
          dns_records?: Json;
          domain?: string;
          id?: string;
          last_checked_at?: string | null;
          project_id?: string;
          ssl_status?: string;
          updated_at?: string;
          user_id?: string;
          verification_status?: string;
          verification_token?: string;
          verified_at?: string | null;
        };
        Relationships: [];
      };
      deployment_logs: {
        Row: {
          created_at: string;
          deployment_id: string;
          id: number;
          level: string;
          message: string;
          project_id: string;
          seq: number;
          stage: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          deployment_id: string;
          id?: never;
          level?: string;
          message: string;
          project_id: string;
          seq: number;
          stage?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          deployment_id?: string;
          id?: never;
          level?: string;
          message?: string;
          project_id?: string;
          seq?: number;
          stage?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      deployments: {
        Row: {
          ai_diagnosis: Json | null;
          artifact_key: string | null;
          artifact_size_bytes: number;
          artifact_storage_provider: string | null;
          build_duration_ms: number | null;
          created_at: string;
          deployment_number: number;
          environment: string;
          error_summary: string | null;
          finished_at: string | null;
          git_author: string | null;
          git_branch: string | null;
          git_commit_message: string | null;
          git_commit_sha: string | null;
          id: string;
          job_id: string | null;
          preview_url: string | null;
          project_id: string;
          rollback_from_deployment_id: string | null;
          started_at: string | null;
          status: string;
          trigger_source: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          ai_diagnosis?: Json | null;
          artifact_key?: string | null;
          artifact_size_bytes?: number;
          artifact_storage_provider?: string | null;
          build_duration_ms?: number | null;
          created_at?: string;
          deployment_number?: number;
          environment?: string;
          error_summary?: string | null;
          finished_at?: string | null;
          git_author?: string | null;
          git_branch?: string | null;
          git_commit_message?: string | null;
          git_commit_sha?: string | null;
          id?: string;
          job_id?: string | null;
          preview_url?: string | null;
          project_id: string;
          rollback_from_deployment_id?: string | null;
          started_at?: string | null;
          status?: string;
          trigger_source?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          ai_diagnosis?: Json | null;
          artifact_key?: string | null;
          artifact_size_bytes?: number;
          artifact_storage_provider?: string | null;
          build_duration_ms?: number | null;
          created_at?: string;
          deployment_number?: number;
          environment?: string;
          error_summary?: string | null;
          finished_at?: string | null;
          git_author?: string | null;
          git_branch?: string | null;
          git_commit_message?: string | null;
          git_commit_sha?: string | null;
          id?: string;
          job_id?: string | null;
          preview_url?: string | null;
          project_id?: string;
          rollback_from_deployment_id?: string | null;
          started_at?: string | null;
          status?: string;
          trigger_source?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      github_webhook_deliveries: {
        Row: {
          delivery_id: string;
          event_type: string;
          received_at: string;
          repository_full_name: string | null;
        };
        Insert: {
          delivery_id: string;
          event_type: string;
          received_at?: string;
          repository_full_name?: string | null;
        };
        Update: {
          delivery_id?: string;
          event_type?: string;
          received_at?: string;
          repository_full_name?: string | null;
        };
        Relationships: [];
      };
      github_connections: {
        Row: {
          created_at: string;
          encrypted_access_token: string | null;
          github_login: string;
          github_user_id: number | null;
          id: string;
          installation_id: number | null;
          provider_type: string;
          scopes: string[];
          token_expires_at: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          encrypted_access_token?: string | null;
          github_login: string;
          github_user_id?: number | null;
          id?: string;
          installation_id?: number | null;
          provider_type: string;
          scopes?: string[];
          token_expires_at?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          encrypted_access_token?: string | null;
          github_login?: string;
          github_user_id?: number | null;
          id?: string;
          installation_id?: number | null;
          provider_type?: string;
          scopes?: string[];
          token_expires_at?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          email: string | null;
          full_name: string | null;
          id: string;
          plan: string;
          updated_at: string;
          username: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id: string;
          plan?: string;
          updated_at?: string;
          username?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id?: string;
          plan?: string;
          updated_at?: string;
          username?: string | null;
        };
        Relationships: [];
      };
      project_env_vars: {
        Row: {
          created_at: string;
          encrypted_value: string;
          environment: string;
          id: string;
          is_secret: boolean;
          key: string;
          project_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          encrypted_value: string;
          environment?: string;
          id?: string;
          is_secret?: boolean;
          key: string;
          project_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          encrypted_value: string;
          environment?: string;
          id?: string;
          is_secret?: boolean;
          key?: string;
          project_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          active_deployment_id: string | null;
          auto_deploy: boolean;
          build_command: string;
          created_at: string;
          default_branch: string;
          description: string | null;
          framework: string;
          github_connection_id: string | null;
          id: string;
          install_command: string;
          name: string;
          node_version: string;
          output_directory: string;
          repo_full_name: string | null;
          repo_id: number | null;
          repo_url: string | null;
          root_directory: string;
          slug: string;
          updated_at: string;
          user_id: string;
          webhook_id: number | null;
          webhook_secret_encrypted: string | null;
        };
        Insert: {
          active_deployment_id?: string | null;
          auto_deploy?: boolean;
          build_command?: string;
          created_at?: string;
          default_branch?: string;
          description?: string | null;
          framework?: string;
          github_connection_id?: string | null;
          id?: string;
          install_command?: string;
          name: string;
          node_version?: string;
          output_directory?: string;
          repo_full_name?: string | null;
          repo_id?: number | null;
          repo_url?: string | null;
          root_directory?: string;
          slug: string;
          updated_at?: string;
          user_id: string;
          webhook_id?: number | null;
          webhook_secret_encrypted?: string | null;
        };
        Update: {
          active_deployment_id?: string | null;
          auto_deploy?: boolean;
          build_command?: string;
          created_at?: string;
          default_branch?: string;
          description?: string | null;
          framework?: string;
          github_connection_id?: string | null;
          id?: string;
          install_command?: string;
          name?: string;
          node_version?: string;
          output_directory?: string;
          repo_full_name?: string | null;
          repo_id?: number | null;
          repo_url?: string | null;
          root_directory?: string;
          slug?: string;
          updated_at?: string;
          user_id?: string;
          webhook_id?: number | null;
          webhook_secret_encrypted?: string | null;
        };
        Relationships: [];
      };
      published_routes: {
        Row: {
          active_deployment_id: string | null;
          artifact_key: string | null;
          artifact_storage_provider: string | null;
          project_id: string;
          slug: string;
          updated_at: string;
          verified_domains: string[];
        };
        Insert: {
          active_deployment_id?: string | null;
          artifact_key?: string | null;
          artifact_storage_provider?: string | null;
          project_id: string;
          slug: string;
          updated_at?: string;
          verified_domains?: string[];
        };
        Update: {
          active_deployment_id?: string | null;
          artifact_key?: string | null;
          artifact_storage_provider?: string | null;
          project_id?: string;
          slug?: string;
          updated_at?: string;
          verified_domains?: string[];
        };
        Relationships: [];
      };
      resource_usage_events: {
        Row: {
          deployment_id: string | null;
          id: number;
          metadata: Json;
          metric_type: string;
          project_id: string | null;
          recorded_at: string;
          user_id: string;
          value: number;
        };
        Insert: {
          deployment_id?: string | null;
          id?: never;
          metadata?: Json;
          metric_type: string;
          project_id?: string | null;
          recorded_at?: string;
          user_id: string;
          value: number;
        };
        Update: {
          deployment_id?: string | null;
          id?: never;
          metadata?: Json;
          metric_type?: string;
          project_id?: string | null;
          recorded_at?: string;
          user_id?: string;
          value?: number;
        };
        Relationships: [];
      };
      uptime_checks: {
        Row: {
          checked_at: string;
          error_message: string | null;
          http_status: number | null;
          id: number;
          latency_ms: number | null;
          monitor_id: string;
          project_id: string;
          status: string;
          user_id: string;
        };
        Insert: {
          checked_at?: string;
          error_message?: string | null;
          http_status?: number | null;
          id?: never;
          latency_ms?: number | null;
          monitor_id: string;
          project_id: string;
          status: string;
          user_id: string;
        };
        Update: {
          checked_at?: string;
          error_message?: string | null;
          http_status?: number | null;
          id?: never;
          latency_ms?: number | null;
          monitor_id?: string;
          project_id?: string;
          status?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      uptime_monitors: {
        Row: {
          created_at: string;
          id: string;
          interval_seconds: number;
          is_enabled: boolean;
          last_checked_at: string | null;
          last_http_status: number | null;
          last_latency_ms: number | null;
          last_status: string;
          project_id: string;
          target_url: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          interval_seconds?: number;
          is_enabled?: boolean;
          last_checked_at?: string | null;
          last_http_status?: number | null;
          last_latency_ms?: number | null;
          last_status?: string;
          project_id: string;
          target_url: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          interval_seconds?: number;
          is_enabled?: boolean;
          last_checked_at?: string | null;
          last_http_status?: number | null;
          last_latency_ms?: number | null;
          last_status?: string;
          project_id?: string;
          target_url?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
