# QuantumHost — Phased Implementation Roadmap

## Phase 1: Architecture & Technical Research (Current Phase — Awaiting Approval)
- Complete official documentation research across Next.js, Supabase, GitHub Apps, Redis/BullMQ, Cloudflare, object storage, build sandboxes, and AI APIs.
- Finalize system architecture, deployment lifecycle, provider selection, database ER diagram & RLS design, security architecture, and 7 core `docs/*.md` specifications.
- **Gate**: User reviews and approves selected architecture, provider choices, and roadmap.

## Phase 2: Database Reconciliation, Auth & Control Plane Foundation
- Reconcile and verify all 10+ Supabase tables (`profiles`, `github_connections`, `projects`, `deployments`, `build_logs`, `environment_variables`, `domains`, `health_checks`, `usage_metrics`, `ai_analyses`), indexes, triggers, and RLS policies; run `get_advisors` (`security` & `performance`).
- Verify Next.js App Router + `proxy.ts` + `@supabase/ssr` authentication (registration, login, GitHub OAuth callback, sign out) and core dashboard shell.

## Phase 3: GitHub Integration, Repository Import & Project Configuration
- Implement GitHub App JWT/installation token exchange, OAuth flow, and encrypted PAT fallback.
- Build repository/branch browser, `package.json` framework auto-detection, AES-256-GCM encrypted `environment_variables` CRUD, and `X-Hub-Signature-256` webhook receiver.

## Phase 4: Deployment Queue, Isolated Build Worker, Object Storage & Hosting
- Implement Redis + BullMQ job producer (`quantumhost-builds`) and standalone isolated build worker (`worker/`).
- Implement Cloudflare R2 (`@aws-sdk/client-s3`), Supabase Storage, and local object storage adapters.
- Build live build log streaming, immutable preview URLs (`/d/<deploymentId>`), production site serving (`/sites/<slug>` + Cloudflare Worker edge template), and atomic rollbacks.

## Phase 5: Custom Domains, Availability Monitoring, Usage Telemetry & AI Diagnostics
- Implement custom domain DNS verification (`node:dns/promises` + optional Cloudflare Custom Hostnames API integration).
- Implement HTTP availability probe runner, latency history, resource consumption dashboards (`usage_metrics`), and provider-independent AI failure diagnosis (`ai_analyses`).

## Phase 6: End-to-End Verification & Production Hardening
- Execute TypeScript strict checks, ESLint, unit/integration test suite (crypto, webhook HMAC, framework detection, storage traversal, API auth/ownership), and production build.
- Test live end-to-end deployment with Redis + worker + real GitHub repository, run Supabase security advisors, and finalize operational documentation.
