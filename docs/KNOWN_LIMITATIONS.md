# QuantumHost — Known Limitations & Operational Requirements

This document records verified platform constraints, architectural boundaries, and production prerequisites.

---

## 1. Hosting & Runtime Scope
- **Static Websites & Exported Frontends Only**: QuantumHost's hosting layer (`Cloudflare R2 / Workers`, `Supabase Storage`, and `/sites/[slug]`) serves static HTML, CSS, JavaScript, and asset bundles (`HTML/CSS/JS`, `Vite`, `React`, `Astro`, and `Next.js` configured with `output: 'export'`). Persistent server-side Node.js SSR processes, Next.js custom Edge API routes inside tenant apps, Python/Docker web services, and WebSocket servers are not supported on the current static-edge hosting adapter.
- **No Unconfigured Wildcard URLs**: Subdomain URLs of the form `https://<slug>.quantumhost.app` require configuring `NEXT_PUBLIC_PLATFORM_DOMAIN` with matching wildcard DNS (`*.quantumhost.app`) and TLS termination. When `NEXT_PUBLIC_PLATFORM_DOMAIN` is unset, QuantumHost issues working `<appUrl>/sites/<slug>` and `<appUrl>/d/<deploymentId>` routes directly on the active host.

## 2. Asynchronous Worker & Build Infrastructure Prerequisites
- **Separate Worker Process Required for Real Builds**: Triggering deployments from `/api/deployments` or `/api/webhooks/github` requires a running **Redis** instance (`REDIS_URL`), `SUPABASE_SERVICE_ROLE_KEY`, `ENCRYPTION_MASTER_KEY`, and at least one separate **BullMQ Build Worker** process (`npm run worker:start` / `worker/Dockerfile`). Running only the Next.js control plane on Vercel will enqueue jobs to Redis (or fail with HTTP `503` if Redis is unreachable) without executing builds.
- **Container Sandbox Isolation (`DOCKER_ISOLATION=true`)**: Process-level workspace isolation (`os.tmpdir()/qh-builds/<deploymentId>`), sanitized child `env`, timeouts, and output quotas work natively, but strict kernel/cgroup CPU, memory, PID, and `--network=none` build isolation requires a Docker-capable Linux host with `DOCKER_ISOLATION=true`.
- **Worker `git clone` with Installation Tokens**: Private repository clones embed the short-lived GitHub access token in the `https://x-access-token:<token>@github.com/...` URL passed to `git` (`shell: false`). While tokens are short-lived and scrubbed from logs, multi-tenant high-security deployments should isolate builds in ephemeral containers/VMs so process arguments are invisible to sibling tenants.

## 3. Vercel Deployment & Serverless Constraints
- **Vercel Hobby Plan Cron Limit**: `vercel.json` schedules `/api/monitoring/cron` daily (`0 0 * * *`) to stay compatible with Vercel Hobby plans (which reject more-than-once-daily crons). High-frequency checks (1–15 minutes) require either Vercel Pro or calling `GET /api/monitoring/cron` with `Authorization: Bearer $CRON_SECRET` from an external scheduler (such as GitHub Actions).
- **In-Memory API Rate Limiter**: `src/lib/security/rate-limit.ts` uses an in-memory per-process sliding window. In multi-instance serverless environments (e.g., Vercel Functions), rate limit counters are local per warm instance rather than globally shared; switch this helper to Redis-backed counters when scaling horizontally.
- **Local Artifact Provider on Serverless**: `ARTIFACT_STORAGE_PROVIDER=local` writes files to `.quantumhost-storage` on local disk and is intended strictly for single-node local development. Production deployments on Vercel + remote workers **must** configure `ARTIFACT_STORAGE_PROVIDER=s3` (Cloudflare R2 / AWS S3) or `supabase` so both the build worker and web serving routes read from shared object storage.

## 4. Custom Domains, SSL & AI Integration
- **Custom Domain TLS Verification**: Without `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ZONE_ID` (Cloudflare for SaaS Custom Hostnames), QuantumHost can verify DNS `TXT`/`CNAME` records and probe existing external TLS certificates (`tls.connect`), but cannot mint new edge certificates automatically. `ssl_status` will remain `"pending"` or `"provisioning"` until an active valid TLS certificate is served over HTTPS.
- **Pre-Deployment Intelligence Scope**: `analyzeDeployReadiness()` performs static inspection of root config files, `package.json`, scripts, and `.env.example` variable names. It highlights likely issues before build, but cannot predict all runtime errors, transitive npm registry outages, or private code compilation errors.
- **AI Copilot Requires External API Key**: Neither `POST /api/ai/diagnose` nor `POST /api/ai/copilot` falls back to synthetic answers when `AI_API_KEY` (and per-user `ai_configurations.encrypted_api_key`) is unset. Copilot suggestions are strictly read-only advisories and never modify files or execute commands automatically.

## 5. Supabase Auth Security Setting
- **Leaked Password Protection**: Supabase Security Advisor reported `auth_leaked_password_protection` is disabled on project `ufmfbsrthpjahrnawirg`. Enable HaveIBeenPwned password checking in the Supabase Dashboard (**Authentication -> Providers / Attack Protection**) before opening public registration.
