-- Phase 3 Schema Enhancements:
-- 1. Add optional unique username on profiles
-- 2. Add description field on projects
-- 3. Add ai_analyses history table with strict RLS & FK indexes

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_username_format_chk'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_username_format_chk
      CHECK (username IS NULL OR username ~ '^[a-z0-9][a-z0-9._-]{1,37}[a-z0-9]$');
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique_idx
  ON public.profiles (lower(username))
  WHERE username IS NOT NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_raw_username text;
  v_clean_username text;
BEGIN
  v_raw_username := lower(trim(COALESCE(NEW.raw_user_meta_data->>'username', NEW.raw_user_meta_data->>'user_name', '')));
  IF v_raw_username ~ '^[a-z0-9][a-z0-9._-]{1,37}[a-z0-9]$' THEN
    v_clean_username := v_raw_username;
  ELSE
    v_clean_username := NULL;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, username, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(COALESCE(NEW.email, ''), '@', 1)),
    v_clean_username,
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS description text;

CREATE TABLE IF NOT EXISTS public.ai_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_id uuid NOT NULL REFERENCES public.deployments(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  analysis_type text NOT NULL DEFAULT 'build_failure'
    CHECK (analysis_type IN ('build_failure', 'performance', 'security', 'configuration')),
  summary text NOT NULL,
  findings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_analyses_deployment_created_idx
  ON public.ai_analyses (deployment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_analyses_project_id_idx
  ON public.ai_analyses (project_id);
CREATE INDEX IF NOT EXISTS ai_analyses_user_id_idx
  ON public.ai_analyses (user_id);

ALTER TABLE public.ai_analyses ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ai_analyses' AND policyname = 'ai_analyses_select_own') THEN
    CREATE POLICY ai_analyses_select_own ON public.ai_analyses
      FOR SELECT TO authenticated
      USING ((select auth.uid()) = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ai_analyses' AND policyname = 'ai_analyses_insert_own') THEN
    CREATE POLICY ai_analyses_insert_own ON public.ai_analyses
      FOR INSERT TO authenticated
      WITH CHECK ((select auth.uid()) = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ai_analyses' AND policyname = 'ai_analyses_delete_own') THEN
    CREATE POLICY ai_analyses_delete_own ON public.ai_analyses
      FOR DELETE TO authenticated
      USING ((select auth.uid()) = user_id);
  END IF;
END $$;
