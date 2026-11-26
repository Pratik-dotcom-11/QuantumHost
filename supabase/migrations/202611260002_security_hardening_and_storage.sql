-- Security Hardening, Storage Bucket & Public Route Resolution Table

-- 1. Revoke direct RPC execution of trigger functions from public/client roles
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_deployment_number() FROM PUBLIC, anon, authenticated;

-- 2. Published Routes table for zero-secret public site & custom domain resolution
CREATE TABLE IF NOT EXISTS public.published_routes (
  project_id uuid PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  active_deployment_id uuid REFERENCES public.deployments(id) ON DELETE SET NULL,
  artifact_storage_provider text CHECK (artifact_storage_provider IN ('local', 's3', 'supabase')),
  artifact_key text,
  verified_domains text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS published_routes_active_deployment_idx ON public.published_routes (active_deployment_id);
CREATE INDEX IF NOT EXISTS published_routes_verified_domains_gin ON public.published_routes USING gin (verified_domains);

ALTER TABLE public.published_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY published_routes_public_select ON public.published_routes
  FOR SELECT TO anon, authenticated
  USING (active_deployment_id IS NOT NULL);

-- Trigger function to keep published_routes synchronized with projects & custom_domains
CREATE OR REPLACE FUNCTION public.sync_published_route()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_project_id uuid;
  v_slug text;
  v_active_id uuid;
  v_provider text;
  v_key text;
  v_domains text[];
BEGIN
  -- When triggered from projects table, NEW.id is project_id; from custom_domains, NEW.project_id is project_id
  IF TG_TABLE_NAME = 'projects' THEN
    v_project_id := NEW.id;
  ELSIF TG_TABLE_NAME = 'custom_domains' THEN
    v_project_id := COALESCE(NEW.project_id, OLD.project_id);
  END IF;

  SELECT p.slug, p.active_deployment_id
  INTO v_slug, v_active_id
  FROM public.projects p
  WHERE p.id = v_project_id;

  IF v_slug IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF v_active_id IS NOT NULL THEN
    SELECT d.artifact_storage_provider, d.artifact_key
    INTO v_provider, v_key
    FROM public.deployments d
    WHERE d.id = v_active_id AND d.status = 'ready';
  END IF;

  SELECT COALESCE(array_agg(cd.domain ORDER BY cd.domain), '{}')
  INTO v_domains
  FROM public.custom_domains cd
  WHERE cd.project_id = v_project_id AND cd.verification_status = 'verified';

  INSERT INTO public.published_routes (
    project_id,
    slug,
    active_deployment_id,
    artifact_storage_provider,
    artifact_key,
    verified_domains,
    updated_at
  )
  VALUES (
    v_project_id,
    v_slug,
    v_active_id,
    v_provider,
    v_key,
    v_domains,
    now()
  )
  ON CONFLICT (project_id) DO UPDATE SET
    slug = EXCLUDED.slug,
    active_deployment_id = EXCLUDED.active_deployment_id,
    artifact_storage_provider = EXCLUDED.artifact_storage_provider,
    artifact_key = EXCLUDED.artifact_key,
    verified_domains = EXCLUDED.verified_domains,
    updated_at = now();

  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_published_route() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE TRIGGER projects_sync_published_route
  AFTER INSERT OR UPDATE OF slug, active_deployment_id ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.sync_published_route();

CREATE OR REPLACE TRIGGER custom_domains_sync_published_route
  AFTER INSERT OR UPDATE OR DELETE ON public.custom_domains
  FOR EACH ROW EXECUTE FUNCTION public.sync_published_route();

-- 3. Create private Supabase Storage bucket for deployment artifacts
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('deployments', 'deployments', false, 52428800)
ON CONFLICT (id) DO NOTHING;
