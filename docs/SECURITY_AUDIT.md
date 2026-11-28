# QuantumHost — Security Audit Report (Phase 8)

**Audit Date:** 2026-11-28  
**Scope:** Authentication & Session Management, Supabase PostgreSQL RLS & Permissions, Control Plane APIs, Hosting & Domain Verification, and Build Worker Isolation.  
**Auditor Role:** Application Security & QA Engineering Review.

---

## 1. Executive Summary

All **Critical** and **High** severity issues identified during code review and live database inspection were remediated and covered by automated regression tests (`tests/security-audit.test.ts` and `tests/hosting-domains.test.ts`) before production release.

| Severity | Finding | Status | Remediation Summary |
| --- | --- | --- | --- |
| **Critical / High** | Shell & argument injection risk in `git clone` worker invocation (`src/lib/worker/build-runner.ts`) | **Fixed** | Replaced `shell: true` string interpolation with `spawn("git", [..., "--", cloneUrl, "repo"], { shell: false })`, strict `sanitizeGitBranchName()`, `isValidRepoFullName()`, and allowlisted Docker Node versions (`18`, `20`, `22`, `24`). |
| **High** | Server-Side Request Forgery (SSRF) in monitoring probe URLs & AI custom endpoints (`src/app/api/monitoring/route.ts`, `src/app/api/ai/config/route.ts`, `src/lib/monitoring/prober.ts`) | **Fixed** | Added `assertSafeOutboundHttpUrl()` rejecting loopback, link-local IMDS (`169.254.169.254`), RFC1918 private networks, IPv6 unique-local/link-local addresses, embedded credentials, DNS-to-private-IP resolution, and non-HTTPS AI `baseUrl` values. |
| **High** | Open Redirect via `next` parameter on `/auth/callback` and `/login` (`//evil.com`, `/\evil.com`) | **Fixed** | Added `sanitizeRelativeRedirectPath()` in `src/lib/security/redirect.ts` rejecting protocol-relative (`//`), backslash (`/\`), and external origins. |
| **High** | Multi-tenant proxy misclassifying `*.vercel.app` hosts as unconfigured custom domains | **Fixed** | Updated `parseHostingHost()` and `src/proxy.ts` to treat all `*.vercel.app` and `VERCEL_*` URLs as `control-plane`, and pass unverified hosts cleanly through unless explicitly registered in `published_routes`. |
| **Medium** | Missing per-user rate limiting on resource-intensive API routes | **Fixed** | Added sliding-window `checkRateLimit()` returning HTTP `429` (`Retry-After`, `X-RateLimit-*`) across `/api/deployments`, `/api/domains`, `/api/domains/[id]/verify`, `/api/monitoring/check`, `/api/ai/copilot`, `/api/ai/diagnose`, and `/api/projects/[id]/analyze`. |
| **Medium** | Missing baseline browser security headers on Next.js responses | **Fixed** | Added `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Permissions-Policy` in `next.config.ts`. |
| **Medium (Config)** | Vercel Hobby deployment failure from 5-minute cron schedule (`vercel.json`) | **Fixed** | Adjusted `/api/monitoring/cron` schedule in `vercel.json` to daily (`0 0 * * *`) for Hobby compatibility and enforced timing-safe `CRON_SECRET` Bearer verification. |
| **Low / Warn** | Non-constant-time OAuth `state` comparison (`src/app/api/github/oauth/callback/route.ts`) | **Fixed** | Switched OAuth `state` and cron bearer validation to `crypto.timingSafeEqual()`. |
| **Warn (Platform Setting)** | Supabase Auth Leaked Password Protection disabled (`auth_leaked_password_protection` advisor warning) | **Open (Dashboard Config)** | Requires enabling HaveIBeenPwned password protection inside the Supabase Dashboard Auth Security settings (cannot be modified via SQL migration). |

---

## 2. Domain-by-Domain Audit Findings

### 2.1 Authentication & Session Security
- **SSR & Cookie Session Verification (`src/proxy.ts`, `src/lib/auth.ts`)**: `src/proxy.ts` performs fast local JWT claim inspection via `supabase.auth.getClaims()` to refresh cookies and redirect unauthenticated requests (`307 -> /login`) on protected console prefixes (`/dashboard`, `/projects`, `/deployments`, `/domains`, `/monitoring`, `/usage`, `/copilot`, `/settings`). Authoritative Route Handlers and Server Components verify sessions with `supabase.auth.getUser()` via `requireApiUser()` / `requirePageUser()`.
- **Registration, Login, Verification & Password Reset**: Uses official `@supabase/ssr` PKCE flows (`signUp` with `emailRedirectTo`, `signInWithPassword`, `signInWithOAuth`, `resetPasswordForEmail` with `redirectTo`, `updateUser`). Minimum 8-character password validation is enforced client-side and by Supabase Auth.
- **Signout CSRF Hygiene**: Logout occurs via `POST /auth/signout`, invalidating Supabase session cookies server-side.
- **Open Redirect Remediation**: Replaced naive `.startsWith("/")` checks in `/auth/callback` and `/login` with `sanitizeRelativeRedirectPath()`.

### 2.2 Database & Supabase RLS Security
Audited against live Supabase project `ufmfbsrthpjahrnawirg` via SQL inspection and Supabase Security Advisors:
- **Row Level Security (`pg_class.relrowsecurity = true`)**: Enabled on all **14 tables** in `public` (`ai_analyses`, `ai_configurations`, `custom_domains`, `deployment_logs`, `deployments`, `github_connections`, `github_webhook_deliveries`, `profiles`, `project_env_vars`, `projects`, `published_routes`, `resource_usage_events`, `uptime_checks`, `uptime_monitors`).
- **Tenant Isolation**: Every tenant-owned table enforces `(select auth.uid()) = user_id` (or `id` on `profiles`) for `authenticated`. `github_webhook_deliveries` intentionally defines 0 public/authenticated policies (`INFO` advisor notice `rls_enabled_no_policy`), blocking all direct browser/API access while allowing `service_role` webhook deduplication.
- **Public Routing Surface**: `published_routes` exposes only `slug`, `active_deployment_id`, `artifact_storage_provider`, `artifact_key`, and `verified_domains` for active (`active_deployment_id IS NOT NULL`) projects via `published_routes_public_select`. Trigger functions (`handle_new_user`, `set_updated_at`, `assign_deployment_number`, `sync_published_route`, `sync_published_route_on_deployment`, `validate_deployment_status_transition`) set `search_path = ''` and revoke direct `EXECUTE` privileges from `PUBLIC`, `anon`, and `authenticated`.
- **SQL Injection Prevention**: Control plane queries strictly use Supabase parameterized client methods (`eq`, `in`, `contains`) without raw string-concatenated SQL.

### 2.3 API & Secret Management Security
- **Server-Side Encryption (`src/lib/crypto.ts`)**: User secrets (`github_connections.encrypted_access_token`, `project_env_vars.encrypted_value`, `ai_configurations.encrypted_api_key`, `projects.webhook_secret_encrypted`) use AES-256-GCM authenticated encryption backed by `ENCRYPTION_MASTER_KEY`. Secret columns are never returned in plaintext (UI receives masked previews or key names only for non-secret vars).
- **Webhook Verification (`src/app/api/webhooks/github/route.ts`)**: Reads exact raw request body text and verifies `X-Hub-Signature-256` with HMAC-SHA256 + `crypto.timingSafeEqual` before storing `delivery_id` or enqueueing builds.
- **SSRF & Rate Limiting**: `assertSafeOutboundHttpUrl()` protects monitor target updates/probes and AI custom base URLs; `checkRateLimit()` enforces per-user request quotas on mutation/costly endpoints. (Note: rate-limiter state is in-memory per serverless instance; see `KNOWN_LIMITATIONS.md`).

### 2.4 Build Infrastructure Security
- **Control Plane Separation**: Next.js never runs `git clone`, `npm ci`, or project `build` scripts inside web request handlers.
- **Ephemeral Workspace & Credential Isolation (`src/lib/worker/build-runner.ts`)**:
  - Each build uses a unique `os.tmpdir()/qh-builds/<deploymentId>` workspace cleaned up in `finally`.
  - Child `buildEnv` includes only `PATH`, `HOME`, `TEMP`, `TMP`, `SystemRoot`, `NODE_ENV=production`, `CI=true`, `NODE_OPTIONS=--max-old-space-size=1024`, and decrypted project env vars — **excluding** `SUPABASE_SERVICE_ROLE_KEY`, `ENCRYPTION_MASTER_KEY`, `GITHUB_APP_PRIVATE_KEY`, `REDIS_URL`, and `AI_API_KEY`.
  - Git tokens and project secrets are scrubbed (`[REDACTED]`) before writing build logs (`maxLogLines = 2500`).
  - `runIsolatedCommand` kills timed-out process trees (`taskkill /f /t` on Windows, negative PID `SIGKILL` process group on POSIX) cleanly.
  - `walkDirectory` in `src/lib/storage/artifacts.ts` skips symbolic links to prevent symlink-escape exfiltration, and `BUILD_MAX_OUTPUT_BYTES` enforces artifact size quotas.
  - Optional `DOCKER_ISOLATION=true` runs `docker run --rm --user 1000:1000 --cpus=1 --memory=1g --pids-limit=256 --cap-drop=ALL --security-opt=no-new-privileges:true` with `--network=none` during `build`.
