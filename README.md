# QuantumHost

Production-oriented cloud hosting and deployment platform built with Next.js, TypeScript, Tailwind CSS, Supabase (PostgreSQL + Auth + Realtime + Storage), Redis + BullMQ isolated build workers, and a provider-independent AI diagnostics layer.

## Architecture Overview

1. **Control Plane (`src/app`)**:
   - **Next.js 16 App Router + `src/proxy.ts`**: Session refresh and coarse route protection using `@supabase/ssr` (`getClaims()` on the edge/proxy boundary and `getUser()` in every Server Component and Route Handler).
   - **Supabase PostgreSQL + RLS (`supabase/migrations/`)**: 12 tables with Row Level Security enabled on every table, indexed foreign keys, monotonic `deployment_number` trigger, automatic `profiles` creation, and `published_routes` synchronization.
   - **AES-256-GCM Secret Vault (`src/lib/crypto.ts`)**: Encrypts GitHub tokens, project environment variables, webhook secrets, and user AI API keys before database storage.

2. **GitHub Integration & Webhooks (`src/lib/github/client.ts`, `src/app/api/webhooks/github/route.ts`)**:
   - Supports GitHub App installations (`RS256` JWT + installation token minting), GitHub OAuth, and fine-grained/classic Personal Access Tokens.
   - Inspects `package.json` to auto-detect Next.js, Vite, React (CRA), Astro, Node, or static presets.
   - Verifies incoming GitHub `push` webhooks using `X-Hub-Signature-256` (`HMAC-SHA256` + `crypto.timingSafeEqual`) before enqueueing builds.

3. **Deployment Queue & Isolated Build Worker (`src/lib/queue/bullmq.ts`, `src/lib/worker/build-runner.ts`, `worker/index.ts`)**:
   - Enqueues deployment jobs to Redis via **BullMQ** (`quantumhost-builds`) with deduplication (`jobId = deploymentId`) and enforced 11-state transitions (`queued` -> `initializing` -> `cloning` -> `analyzing` -> `building` -> `uploading` -> `deploying` -> `verifying` -> `ready` | `failed` | `cancelled`).
   - Standalone worker executes repositories inside isolated per-deployment temporary directories (`os.tmpdir()/qh-builds/<deploymentId>`), strips platform secrets from child environments, enforces `BUILD_TIMEOUT_MS` process-tree kills and output size quotas, and supports hardened Docker isolation (`DOCKER_ISOLATION=true`).

4. **Object Storage, Hosting & Custom Domains (`src/lib/deployments/hosting-adapter.ts`, `src/proxy.ts`, `src/lib/hosting/`)**:
   - Supports **Cloudflare R2 / AWS S3** (`ARTIFACT_STORAGE_PROVIDER=s3`), **Supabase Storage** (`supabase`), or **Local Object Store** (`local`).
   - Modular hosting adapters (`quantumhost-edge`, `cloudflare-saas`) serve live production URLs (`https://<slug>.<platformDomain>` / `/sites/<slug>`), unique deployment preview URLs (`https://<slug>-d-<uuid32>.<platformDomain>` / `/d/<deploymentId>`), and verified custom domains with real DNS + TLS/HTTPS verification and verified atomic rollbacks.

5. **Five QuantumHost Product Differentiators**:
   - **Deploy Intelligence (`/api/projects/[id]/analyze`, `src/lib/intelligence/deploy-analyzer.ts`)**: Pre-deployment static analysis checking framework detection, missing config files, build commands, output directory paths, `.env.example` variable coverage, and dependency warnings.
   - **Deployment Timeline (`src/components/deployments/deployment-timeline.tsx`)**: Chronological release rail showing commit SHAs, branches, start/end timestamps, durations, artifact sizes, logs, and verified rollback promotion.
   - **Live Health Monitor (`/monitoring`, `/api/monitoring/check`, `/api/monitoring/cron`)**: On-demand and scheduled HTTP availability probes persisting latency/status history in `uptime_checks`, rendered with availability %, latency sparkline chart, last healthy check, and failure logs.
   - **Resource Transparency (`/usage`, `/api/usage`, `src/lib/usage/summary.ts`)**: Displays recorded build minutes, artifact storage, origin-metered bandwidth, deployment counts, HTTP requests, and AI tokens with explicit measurement methodology labels.
   - **Deployment Copilot (`/copilot`, `/api/ai/copilot`, `src/lib/ai/provider.ts`)**: Server-side provider-independent AI assistant (Gemini, OpenAI, Anthropic, or OpenAI-compatible) grounded in logs, configurations, and usage telemetry — never exposes keys to the browser or auto-edits code, and prompts setup cleanly when unconfigured.

## Getting Started

### 1. Configure Environment Variables

Copy `.env.example` to `.env.local` and configure:
- `NEXT_PUBLIC_SUPABASE_URL` & `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (already populated for your connected Supabase project)
- `SUPABASE_SERVICE_ROLE_KEY` (required by the background build worker, incoming GitHub webhooks, and request telemetry)
- `ENCRYPTION_MASTER_KEY` (64 hex chars / 32 bytes)
- `REDIS_URL` (e.g. `redis://127.0.0.1:6379`)

### 2. Run Redis (for Deployment Queue & Worker)

```bash
docker run -d --name quantumhost-redis -p 6379:6379 redis:7-alpine
```

### 3. Run the Control Plane & Build Worker

```bash
# Terminal 1: Next.js control plane
npm run dev

# Terminal 2: Isolated BullMQ build worker
npm run worker:dev
```

### 4. Verification Commands

```bash
npm run typecheck
npm test
npm run build
```
