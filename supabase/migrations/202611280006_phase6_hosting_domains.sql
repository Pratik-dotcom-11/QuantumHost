-- Phase 6: Website Hosting, Edge URLs, Rollback Sync, and Custom Domain SSL Verification

-- 1. Extend deployments with hosting provider metadata & verified production URL
ALTER TABLE public.deployments
  ADD COLUMN IF NOT EXISTS hosting_provider text NOT NULL DEFAULT 'quantumhost-edge',
  ADD COLUMN IF NOT EXISTS production_url text,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;

-- 2. Extend custom_domains with provider API tracking and real HTTPS/TLS verification columns
ALTER TABLE public.custom_domains
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'dns' CHECK (provider IN ('dns', 'cloudflare')),
  ADD COLUMN IF NOT EXISTS provider_hostname_id text,
  ADD COLUMN IF NOT EXISTS https_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS https_status_code integer,
  ADD COLUMN IF NOT EXISTS verification_error text,
  ADD COLUMN IF NOT EXISTS last_https_checked_at timestamptz;

CREATE INDEX IF NOT EXISTS custom_domains_provider_hostname_idx
  ON public.custom_domains (provider_hostname_id)
  WHERE provider_hostname_id IS NOT NULL;

-- 3. Keep published_routes synced when an active deployment status changes (e.g. transitions to 'ready')
CREATE OR REPLACE FUNCTION public.sync_published_route_on_deployment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_is_active boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = NEW.project_id AND p.active_deployment_id = NEW.id
  ) INTO v_is_active;

  IF v_is_active THEN
    UPDATE public.published_routes
    SET
      artifact_storage_provider = CASE WHEN NEW.status = 'ready' THEN NEW.artifact_storage_provider ELSE NULL END,
      artifact_key = CASE WHEN NEW.status = 'ready' THEN NEW.artifact_key ELSE NULL END,
      updated_at = now()
    WHERE project_id = NEW.project_id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_published_route_on_deployment() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE TRIGGER deployments_sync_published_route
  AFTER UPDATE OF status, artifact_key, artifact_storage_provider ON public.deployments
  FOR EACH ROW EXECUTE FUNCTION public.sync_published_route_on_deployment();
