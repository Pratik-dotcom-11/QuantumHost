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

3. **Deployment Queue & Isolated Build Worker (`src/lib/queue/bullmq.ts`, `worker/index.ts`)**:
   - Enqueues deployment jobs to Redis via **BullMQ** (`quantumhost-builds`).
   - Standalone worker (`worker/index.ts`) clones repositories into isolated per-deployment temporary directories, strips platform secrets (`SUPABASE_*`, `ENCRYPTION_MASTER_KEY`, `REDIS_URL`, etc.) from child process environments, enforces `BUILD_TIMEOUT_MS`, streams redacted logs to `deployment_logs`, and optionally supports Docker container isolation (`DOCKER_ISOLATION=true`).

4. **Object Storage & Live Hosting (`src/lib/storage/artifacts.ts`, `src/app/sites/[slug]`, `src/app/d/[deploymentId]`)**:
   - Supports **Cloudflare R2 / AWS S3** (`ARTIFACT_STORAGE_PROVIDER=s3`), **Supabase Storage** (`supabase`), or **Local Object Store** (`local`).
   - Serves live sites at `/sites/<slug>` and immutable deployment previews at `/d/<deploymentId>`.
   - Supports instant zero-downtime rollbacks by atomically updating `projects.active_deployment_id`.

5. **Custom Domains, Availability Monitoring, Telemetry & AI**:
   - **Custom Domains (`/domains`)**: Generates `TXT` and `CNAME` records and verifies DNS propagation via `node:dns/promises`.
   - **Monitoring (`/monitoring`)**: Runs live HTTP probes measuring HTTP status codes and latency, storing history in `uptime_checks`.
   - **Resource Usage (`/usage`)**: Tracks build compute seconds, artifact storage, served bandwidth, HTTP requests, and AI tokens.
   - **AI Diagnostics (`src/lib/ai/provider.ts`)**: Provider-independent adapter supporting **Google Gemini**, **OpenAI**, **Anthropic Claude**, and custom OpenAI-compatible endpoints.

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
