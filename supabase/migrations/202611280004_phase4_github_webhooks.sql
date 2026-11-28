-- Phase 4 GitHub Integration:
-- Webhook delivery deduplication table (server-side service role only)

CREATE TABLE IF NOT EXISTS public.github_webhook_deliveries (
  delivery_id text PRIMARY KEY,
  event_type text NOT NULL,
  repository_full_name text,
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS github_webhook_deliveries_received_at_idx
  ON public.github_webhook_deliveries (received_at DESC);

ALTER TABLE public.github_webhook_deliveries ENABLE ROW LEVEL SECURITY;
