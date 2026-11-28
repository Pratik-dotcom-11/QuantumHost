# QuantumHost — Quality Assurance & Test Report (Phase 8)

**Test Execution Date:** 2026-11-28  
**Environment:** Windows 11 (`node` v24.19.0), Next.js `16.4.6` (`next build --webpack` + `next start -p 3000`), Vitest `v4.1.12`, connected Supabase project `ufmfbsrthpjahrnawirg`.

> **Reporting Policy:** Only checks that were actually executed and observed in this workspace are marked as passed. Features depending on external daemons or third-party credentials unavailable in the local test environment are explicitly marked as **Blocked / Mocked Scope**.

---

## 1. Automated Test Suite (`vitest run`)

**Result:** **8 test files passed, 32 tests passed** (`0 failed`, `0 skipped`).

| Test File | Tests Passed | Scope & Verification Type |
| --- | --- | --- |
| `tests/crypto.test.ts` | 4 / 4 | Real AES-256-GCM encryption/decryption roundtrip, tamper detection, masking. |
| `tests/frameworks.test.ts` | 3 / 3 | Framework auto-detection from `package.json` (`nextjs`, `vite`, `astro`, `react`, `static`). |
| `tests/github-webhook.test.ts` | 8 / 8 | HMAC-SHA256 `X-Hub-Signature-256` verification + webhook push/PR routing decisions. |
| `tests/storage.test.ts` | 1 / 1 | Local object storage directory upload + `readArtifactAsset` serving & `..` traversal block. |
| `tests/deployment-engine.test.ts` | 4 / 4 | All 11 lifecycle states + illegal transition rejection, `resolveSafeSubdir` path escape block, log secret redaction, 150ms child timeout kill, static HTML/CSS/JS bundle verification, and real offline `vite build` + JS/HTML artifact serving. |
| `tests/hosting-domains.test.ts` | 4 / 4 | Unique URL generation + host parsing (including `*.vercel.app` control-plane fix), modular hosting adapter selection, Cloudflare Custom Hostnames API integration (mocked HTTP), honest DNS/TLS/HTTPS verification logic, live static route `/sites/[slug]`, preview `/d/[id]`, and verified rollback route (`POST /api/deployments/[id]/rollback`, mocked Supabase route doubles + real local storage artifacts). |
| `tests/phase7-features.test.ts` | 4 / 4 | Deploy Intelligence analyzer (`vite` ready vs unexported `nextjs` + missing scripts/env blockers), Live HTTP Health Prober (`runHttpProbe` against live local Node `http.Server` 200/502), Resource Transparency telemetry aggregation, and Deployment Copilot (`400` unconfigured refusal without key + grounded Gemini/OpenAI mocked API calls). |
| `tests/security-audit.test.ts` | 4 / 4 | Open Redirect blocker (`//evil.com`, `/\evil.com`), SSRF protection (IPv4/IPv6 private/metadata ranges & HTTPS enforcement via `assertSafeOutboundHttpUrl` + `runHttpProbe`), API rate limiter (`429` + `Retry-After`), and `sanitizeGitBranchName()` command/argument injection rejection. |

---

## 2. Static Analysis & Production Build

| Check | Command | Outcome | Notes |
| --- | --- | --- | --- |
| TypeScript | `npm run typecheck` (`tsc --noEmit`) | **Passed** (`0` errors) | Strict mode + `noUncheckedIndexedAccess` enabled. |
| ESLint | `npm run lint` (`eslint .`) | **Passed** (`0` errors) | Next.js + TypeScript ESLint rules cleanly satisfied. |
| Production Build | `npm run build` (`next build --webpack`) | **Passed** (exit `0`) | Compiled all 26 App Router pages/APIs and `proxy.ts`. |

---

## 3. Live Server HTTP, Auth, Security Headers & Multi-Tenant Routing Checks

Executed against `node node_modules/next/dist/bin/next start -p 3000`:

| Check Category | Targets Tested | Observed Result |
| --- | --- | --- |
| Public Routes | `/`, `/login`, `/register`, `/reset-password`, `/pricing`, `/docs` | All returned HTTP `200`; SSR HTML contained `<title>`, `viewport` meta, `H1` on content pages, and zero Next error boundary strings. |
| Protected Page Auth Redirects | `/dashboard`, `/projects`, `/projects/new`, `/deployments`, `/domains`, `/monitoring`, `/usage`, `/copilot`, `/settings` | All returned HTTP `307` redirecting to `/login?next=...` when unauthenticated. |
| Protected API Authorization | 12 `GET`/`POST` routes (`/api/projects`, `/api/deployments`, `/api/domains`, `/api/monitoring`, `/api/usage`, `/api/ai/config`, `/api/ai/copilot`, `/api/github/connections`, `/api/github/repos`, etc.) | All returned HTTP `401` (`Authentication required`) without session cookies. |
| Security Headers | `GET /` response headers | Verified `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`. |
| Open Redirect Defense | `GET /auth/callback?next=//evil.com` | Redirected to `/login?error=auth_callback_failed` (external host blocked). |
| Webhook & Cron Protection | `POST /api/webhooks/github` (unsigned), `GET /api/monitoring/cron` (unconfigured secret/service key) | Returned `503` refusing unauthenticated/unconfigured execution cleanly. |
| Host-Header Tenant Routing | Raw TCP `Host: quantumhost.vercel.app`, `Host: quantumhost-git-main-pratik.vercel.app`, `Host: custom-unregistered.example.com`, `Host: nonexistent.quantumhost.app` | Vercel/unverified control-plane hosts returned `200` (QuantumHost app); unconfigured platform subdomain returned `404` (`Deployment Not Found`). |
| Live Health Endpoint | `GET /api/health` | Returned HTTP `200` with `supabase.ok: true` (`ufmfbsrthpjahrnawirg`) and `redis.ok: false` (`status: "degraded"`). |

---

## 4. Database Live Audit (`supabase_mcp`)

- Executed SQL check on `pg_class` / `pg_policies`: confirmed `rls_enabled = true` across all 14 tables in `public` and active policies on all tenant-facing tables.
- Executed Supabase Security Advisor (`get_advisors`): `0` critical/error findings; `1` `WARN` (`auth_leaked_password_protection` disabled in Supabase Auth settings) and `1` `INFO` (`github_webhook_deliveries` intentionally has RLS enabled with 0 public policies).

---

## 5. Checks Not Executed Locally (Explicit Gaps)

| Integration / Check | Reason Not Executed Locally |
| --- | --- |
| **Live Browser Chromium Visual & Mobile DOM QA** | Local Google Chrome DevTools debugging port (`DevToolsActivePort`) was unavailable, so automated Chromium screenshot/overflow/computed-style checks could not execute against `:3000`. SSR HTML landmarks and Tailwind responsive/accessible markup (`sr-only`, `aria-label`, `<Label htmlFor>`) were verified via code & SSR HTML inspection instead. |
| **Authenticated Interactive Browser Session (Signup / GitHub OAuth / Live Project UI E2E)** | Requires interactive browser session + Supabase email/GitHub OAuth callbacks. Core auth guards, PKCE routes, RLS policies, and API schemas were verified. |
| **Redis + BullMQ Worker Live Queue Execution & Docker Sandbox (`DOCKER_ISOLATION=true`)** | `redis-server`, `redis-cli`, and `docker` are not installed on this local Windows workstation, and `SUPABASE_SERVICE_ROLE_KEY` is omitted from `.env.local` by design. Isolated command execution, timeout tree kills, secret redaction, and `vite build` artifact generation were tested directly via `deployment-engine.test.ts`. |
| **Live Cloudflare API (`CLOUDFLARE_API_TOKEN`) & Cloudflare R2 / S3 Bucket Upload (`S3_*`)** | No Cloudflare or R2 credentials exist in local `.env.local`; Cloudflare Custom Hostnames API integration was verified with deterministic HTTP response mocks. |
| **Live External LLM Generation (`AI_API_KEY`)** | No external Gemini/OpenAI/Anthropic key exists in `.env.local`; server-side request/response shaping and unconfigured-key `400` refusal were verified via unit tests. |
| **UI Contrast/Accessibility Note** | On `/login`, `/register`, and `/reset-password`, card titles render `<h3>` without a top-level `<h1>` heading tag; logged as a minor accessibility polish item. |
