-- QuantumHost Initial Database Schema
-- PostgreSQL 17 / Supabase

-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  avatar_url text,
  plan text NOT NULL DEFAULT 'developer' CHECK (plan IN ('developer', 'pro', 'enterprise')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. GitHub Connections (App installations, OAuth, or PAT)
CREATE TABLE IF NOT EXISTS public.github_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider_type text NOT NULL CHECK (provider_type IN ('github_app', 'oauth', 'pat')),
  github_user_id bigint,
  github_login text NOT NULL,
  installation_id bigint,
  encrypted_access_token text,
  token_expires_at timestamptz,
  scopes text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT github_connections_user_login_type_key UNIQUE (user_id, github_login, provider_type)
);

-- 3. Projects
CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  github_connection_id uuid REFERENCES public.github_connections(id) ON DELETE SET NULL,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  framework text NOT NULL DEFAULT 'static' CHECK (framework IN ('nextjs', 'vite', 'react', 'astro', 'static', 'node', 'custom')),
  repo_full_name text,
  repo_id bigint,
  repo_url text,
  default_branch text NOT NULL DEFAULT 'main',
  root_directory text NOT NULL DEFAULT '.',
  install_command text NOT NULL DEFAULT 'npm ci',
  build_command text NOT NULL DEFAULT 'npm run build',
  output_directory text NOT NULL DEFAULT 'dist',
  node_version text NOT NULL DEFAULT '20',
  auto_deploy boolean NOT NULL DEFAULT true,
  webhook_id bigint,
  webhook_secret_encrypted text,
  active_deployment_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT projects_slug_format_chk CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$')
);

-- 4. Project Environment Variables (AES-256-GCM encrypted values)
CREATE TABLE IF NOT EXISTS public.project_env_vars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  key text NOT NULL,
  encrypted_value text NOT NULL,
  is_secret boolean NOT NULL DEFAULT true,
  environment text NOT NULL DEFAULT 'production' CHECK (environment IN ('production', 'preview', 'all')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_env_vars_unique_key UNIQUE (project_id, key, environment)
);

-- 5. Deployments
CREATE TABLE IF NOT EXISTS public.deployments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  deployment_number integer NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'building', 'uploading', 'ready', 'failed', 'cancelled')),
  environment text NOT NULL DEFAULT 'production' CHECK (environment IN ('production', 'preview')),
  trigger_source text NOT NULL DEFAULT 'manual' CHECK (trigger_source IN ('manual', 'git_push', 'rollback', 'api')),
  git_branch text,
  git_commit_sha text,
  git_commit_message text,
  git_author text,
  job_id text,
  artifact_storage_provider text CHECK (artifact_storage_provider IN ('local', 's3', 'supabase')),
  artifact_key text,
  artifact_size_bytes bigint NOT NULL DEFAULT 0,
  preview_url text,
  build_duration_ms integer,
  error_summary text,
  ai_diagnosis jsonb,
  rollback_from_deployment_id uuid REFERENCES public.deployments(id) ON DELETE SET NULL,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT deployments_project_number_key UNIQUE (project_id, deployment_number)
);

-- Add FK from projects.active_deployment_id to deployments.id
ALTER TABLE public.projects
  ADD CONSTRAINT projects_active_deployment_id_fkey
  FOREIGN KEY (active_deployment_id) REFERENCES public.deployments(id) ON DELETE SET NULL;

-- 6. Deployment Logs
CREATE TABLE IF NOT EXISTS public.deployment_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  deployment_id uuid NOT NULL REFERENCES public.deployments(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  seq integer NOT NULL,
  level text NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'warn', 'error', 'debug', 'system')),
  stage text NOT NULL DEFAULT 'build' CHECK (stage IN ('queue', 'clone', 'install', 'build', 'upload', 'deploy', 'system')),
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 7. Custom Domains
CREATE TABLE IF NOT EXISTS public.custom_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  domain text NOT NULL UNIQUE,
  verification_token text NOT NULL,
  verification_status text NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'failed')),
  ssl_status text NOT NULL DEFAULT 'pending' CHECK (ssl_status IN ('pending', 'provisioning', 'active', 'error')),
  dns_records jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_checked_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 8. Uptime Monitors
CREATE TABLE IF NOT EXISTS public.uptime_monitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE UNIQUE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_url text NOT NULL,
  interval_seconds integer NOT NULL DEFAULT 300,
  is_enabled boolean NOT NULL DEFAULT true,
  last_status text NOT NULL DEFAULT 'unknown' CHECK (last_status IN ('up', 'degraded', 'down', 'unknown')),
  last_http_status integer,
  last_latency_ms integer,
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 9. Uptime Check History
CREATE TABLE IF NOT EXISTS public.uptime_checks (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  monitor_id uuid NOT NULL REFERENCES public.uptime_monitors(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('up', 'degraded', 'down')),
  http_status integer,
  latency_ms integer,
  error_message text,
  checked_at timestamptz NOT NULL DEFAULT now()
);

-- 10. Resource Usage Events
CREATE TABLE IF NOT EXISTS public.resource_usage_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  deployment_id uuid REFERENCES public.deployments(id) ON DELETE SET NULL,
  metric_type text NOT NULL CHECK (metric_type IN ('build_seconds', 'storage_bytes', 'bandwidth_bytes', 'http_request', 'ai_tokens')),
  value numeric NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

-- 11. AI Provider Configurations
CREATE TABLE IF NOT EXISTS public.ai_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  provider text NOT NULL DEFAULT 'gemini' CHECK (provider IN ('gemini', 'openai', 'anthropic', 'openai_compatible')),
  model text NOT NULL DEFAULT 'gemini-2.5-flash',
  base_url text,
  encrypted_api_key text,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for Foreign Keys & Query Performance
CREATE INDEX IF NOT EXISTS github_connections_user_id_idx ON public.github_connections (user_id);

CREATE INDEX IF NOT EXISTS projects_user_id_idx ON public.projects (user_id);
CREATE INDEX IF NOT EXISTS projects_github_connection_id_idx ON public.projects (github_connection_id);
CREATE INDEX IF NOT EXISTS projects_active_deployment_id_idx ON public.projects (active_deployment_id);
CREATE INDEX IF NOT EXISTS projects_repo_full_name_idx ON public.projects (repo_full_name);

CREATE INDEX IF NOT EXISTS project_env_vars_project_id_idx ON public.project_env_vars (project_id);
CREATE INDEX IF NOT EXISTS project_env_vars_user_id_idx ON public.project_env_vars (user_id);

CREATE INDEX IF NOT EXISTS deployments_project_id_created_at_idx ON public.deployments (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS deployments_user_id_idx ON public.deployments (user_id);
CREATE INDEX IF NOT EXISTS deployments_status_idx ON public.deployments (status);
CREATE INDEX IF NOT EXISTS deployments_rollback_from_idx ON public.deployments (rollback_from_deployment_id);

CREATE INDEX IF NOT EXISTS deployment_logs_deployment_seq_idx ON public.deployment_logs (deployment_id, seq ASC);
CREATE INDEX IF NOT EXISTS deployment_logs_project_id_idx ON public.deployment_logs (project_id);
CREATE INDEX IF NOT EXISTS deployment_logs_user_id_idx ON public.deployment_logs (user_id);

CREATE INDEX IF NOT EXISTS custom_domains_project_id_idx ON public.custom_domains (project_id);
CREATE INDEX IF NOT EXISTS custom_domains_user_id_idx ON public.custom_domains (user_id);

CREATE INDEX IF NOT EXISTS uptime_monitors_user_id_idx ON public.uptime_monitors (user_id);

CREATE INDEX IF NOT EXISTS uptime_checks_monitor_checked_at_idx ON public.uptime_checks (monitor_id, checked_at DESC);
CREATE INDEX IF NOT EXISTS uptime_checks_project_id_idx ON public.uptime_checks (project_id);
CREATE INDEX IF NOT EXISTS uptime_checks_user_id_idx ON public.uptime_checks (user_id);

CREATE INDEX IF NOT EXISTS resource_usage_events_user_recorded_idx ON public.resource_usage_events (user_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS resource_usage_events_project_recorded_idx ON public.resource_usage_events (project_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS resource_usage_events_deployment_id_idx ON public.resource_usage_events (deployment_id);

-- Triggers & Functions
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER github_connections_set_updated_at BEFORE UPDATE ON public.github_connections FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER projects_set_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER project_env_vars_set_updated_at BEFORE UPDATE ON public.project_env_vars FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER deployments_set_updated_at BEFORE UPDATE ON public.deployments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER custom_domains_set_updated_at BEFORE UPDATE ON public.custom_domains FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER uptime_monitors_set_updated_at BEFORE UPDATE ON public.uptime_monitors FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER ai_configurations_set_updated_at BEFORE UPDATE ON public.ai_configurations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile when a new Supabase Auth user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(COALESCE(NEW.email, ''), '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-assign monotonic deployment_number per project
CREATE OR REPLACE FUNCTION public.assign_deployment_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  next_num integer;
BEGIN
  IF NEW.deployment_number IS NULL OR NEW.deployment_number <= 0 THEN
    PERFORM pg_advisory_xact_lock(hashtext(NEW.project_id::text));
    SELECT COALESCE(MAX(deployment_number), 0) + 1
    INTO next_num
    FROM public.deployments
    WHERE project_id = NEW.project_id;
    NEW.deployment_number := next_num;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER deployments_assign_number
  BEFORE INSERT ON public.deployments
  FOR EACH ROW EXECUTE FUNCTION public.assign_deployment_number();

-- Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.github_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_env_vars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deployment_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uptime_monitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uptime_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_configurations ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = id);

CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

-- GitHub Connections policies
CREATE POLICY github_connections_select_own ON public.github_connections
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY github_connections_insert_own ON public.github_connections
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY github_connections_update_own ON public.github_connections
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY github_connections_delete_own ON public.github_connections
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- Projects policies
CREATE POLICY projects_select_own ON public.projects
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY projects_insert_own ON public.projects
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY projects_update_own ON public.projects
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY projects_delete_own ON public.projects
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- Project Env Vars policies
CREATE POLICY project_env_vars_select_own ON public.project_env_vars
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY project_env_vars_insert_own ON public.project_env_vars
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY project_env_vars_update_own ON public.project_env_vars
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY project_env_vars_delete_own ON public.project_env_vars
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- Deployments policies
CREATE POLICY deployments_select_own ON public.deployments
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY deployments_insert_own ON public.deployments
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY deployments_update_own ON public.deployments
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- Deployment Logs policies
CREATE POLICY deployment_logs_select_own ON public.deployment_logs
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY deployment_logs_insert_own ON public.deployment_logs
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

-- Custom Domains policies
CREATE POLICY custom_domains_select_own ON public.custom_domains
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY custom_domains_insert_own ON public.custom_domains
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY custom_domains_update_own ON public.custom_domains
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY custom_domains_delete_own ON public.custom_domains
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- Uptime Monitors policies
CREATE POLICY uptime_monitors_select_own ON public.uptime_monitors
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY uptime_monitors_insert_own ON public.uptime_monitors
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY uptime_monitors_update_own ON public.uptime_monitors
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY uptime_monitors_delete_own ON public.uptime_monitors
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- Uptime Checks policies
CREATE POLICY uptime_checks_select_own ON public.uptime_checks
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY uptime_checks_insert_own ON public.uptime_checks
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

-- Resource Usage Events policies
CREATE POLICY resource_usage_events_select_own ON public.resource_usage_events
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY resource_usage_events_insert_own ON public.resource_usage_events
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

-- AI Configurations policies
CREATE POLICY ai_configurations_select_own ON public.ai_configurations
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY ai_configurations_insert_own ON public.ai_configurations
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY ai_configurations_update_own ON public.ai_configurations
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY ai_configurations_delete_own ON public.ai_configurations
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- Enable Realtime for live deployment status and build log streaming
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.deployments;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.deployment_logs;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
