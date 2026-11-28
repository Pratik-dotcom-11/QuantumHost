-- Phase 5 Deployment Lifecycle Expansion & Enforced State Transitions

DO $$
DECLARE
  v_con text;
BEGIN
  SELECT conname INTO v_con
  FROM pg_constraint
  WHERE conrelid = 'public.deployments'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%status%';

  IF v_con IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.deployments DROP CONSTRAINT %I', v_con);
  END IF;

  ALTER TABLE public.deployments
    ADD CONSTRAINT deployments_status_check
    CHECK (status IN (
      'queued',
      'initializing',
      'cloning',
      'analyzing',
      'building',
      'uploading',
      'deploying',
      'verifying',
      'ready',
      'failed',
      'cancelled'
    ));
END $$;

DO $$
DECLARE
  v_con text;
BEGIN
  SELECT conname INTO v_con
  FROM pg_constraint
  WHERE conrelid = 'public.deployment_logs'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%stage%';

  IF v_con IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.deployment_logs DROP CONSTRAINT %I', v_con);
  END IF;

  ALTER TABLE public.deployment_logs
    ADD CONSTRAINT deployment_logs_stage_check
    CHECK (stage IN (
      'queue',
      'init',
      'clone',
      'analyze',
      'install',
      'build',
      'upload',
      'deploy',
      'verify',
      'system'
    ));
END $$;

-- Enforce valid deployment lifecycle state transitions at the database layer
CREATE OR REPLACE FUNCTION public.validate_deployment_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  -- Terminal states cannot transition further
  IF OLD.status IN ('ready', 'failed', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid deployment state transition from terminal state % to %', OLD.status, NEW.status;
  END IF;

  -- Any non-terminal active state can transition to failed or cancelled
  IF NEW.status IN ('failed', 'cancelled') THEN
    RETURN NEW;
  END IF;

  IF (OLD.status = 'queued' AND NEW.status IN ('initializing', 'building'))
     OR (OLD.status = 'initializing' AND NEW.status IN ('cloning', 'building'))
     OR (OLD.status = 'cloning' AND NEW.status IN ('analyzing', 'building'))
     OR (OLD.status = 'analyzing' AND NEW.status IN ('building', 'uploading'))
     OR (OLD.status = 'building' AND NEW.status = 'uploading')
     OR (OLD.status = 'uploading' AND NEW.status IN ('deploying', 'ready'))
     OR (OLD.status = 'deploying' AND NEW.status IN ('verifying', 'ready'))
     OR (OLD.status = 'verifying' AND NEW.status = 'ready') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Invalid deployment state transition from % to %', OLD.status, NEW.status;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.validate_deployment_status_transition() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE TRIGGER deployments_validate_status_transition
  BEFORE UPDATE OF status ON public.deployments
  FOR EACH ROW EXECUTE FUNCTION public.validate_deployment_status_transition();
