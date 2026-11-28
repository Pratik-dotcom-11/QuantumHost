# QuantumHost — Deployment Engine & Build Infrastructure

## 1. Architecture Overview

QuantumHost strictly separates the **Control Plane** (Next.js App Router + API routes) from **Build Execution** (standalone BullMQ workers):

1. **Deployment API (`POST /api/deployments`, `POST /api/webhooks/github`)**: Validates ownership or webhook `X-Hub-Signature-256`, creates a `deployments` record (`status = 'queued'`), assigns a monotonic `deployment_number`, and enqueues a Redis/BullMQ job keyed by `jobId = deploymentId` (preventing duplicate jobs).
2. **Job Queue (`src/lib/queue/bullmq.ts`)**: Uses Redis + BullMQ queue `quantumhost-builds` with `attempts: 2` and exponential backoff (`5000ms`), while wrapping deterministic build errors in `UnrecoverableError` so failing user code is not needlessly retried.
3. **Isolated Build Worker (`worker/index.ts`, `src/lib/worker/build-runner.ts`)**: Runs outside the web server process. Executes ephemeral workspace isolation (`os.tmpdir()/qh-builds/<deploymentId>`), secret sanitization, log redaction, serialized log persistence, artifact validation, hosting activation, and real HTTP/storage verification.
4. **Hosting Provider Adapter (`src/lib/deployments/hosting-adapter.ts`)**: Activates immutable artifacts under `<project_id>/<deployment_id>/`, atomically promotes `projects.active_deployment_id` for `production` builds, and verifies entry asset readback + HTTP status before allowing `READY`.

## 2. Enforced State Machine (`src/lib/deployments/lifecycle.ts`)

Both TypeScript guards and PostgreSQL trigger `validate_deployment_status_transition()` enforce valid forward transitions:

`queued` -> `initializing` -> `cloning` -> `analyzing` -> `building` -> `uploading` -> `deploying` -> `verifying` -> `ready` (or terminal `failed` / `cancelled` from any active pre-terminal state).

## 3. Infrastructure Required to Operate Workers

| Component | Purpose | Configuration |
| --- | --- | --- |
| **Redis** | BullMQ queue broker & retry scheduler | `REDIS_URL=redis://...` (local Redis, Upstash TCP, or Redis Cloud) |
| **Worker Host / Container** | Standalone process running `npm run worker:start` ([worker/Dockerfile](../../worker/Dockerfile)) | Node.js 22 LTS + `git` (+ Docker daemon if `DOCKER_ISOLATION=true`) |
| **Supabase Control Plane** | Database, Realtime logs, Auth, RLS | `NEXT_PUBLIC_SUPABASE_URL` + server-only `SUPABASE_SERVICE_ROLE_KEY` + `ENCRYPTION_MASTER_KEY` |
| **Artifact Object Storage** | Immutable deployment bundles | `ARTIFACT_STORAGE_PROVIDER=s3` (Cloudflare R2 / S3), `supabase`, or `local` |

## 4. Security & Resource Quotas

- **Credential Isolation**: `SUPABASE_SERVICE_ROLE_KEY`, `ENCRYPTION_MASTER_KEY`, `GITHUB_APP_PRIVATE_KEY`, `REDIS_URL`, and `AI_API_KEY` are never passed into build subprocesses (`buildEnv` contains only minimal OS vars + decrypted project env vars).
- **Hardened Docker Sandbox (`DOCKER_ISOLATION=true`)**: Runs with `--user 1000:1000`, `--cpus=1`, `--memory=1g`, `--pids-limit=256`, `--cap-drop=ALL`, `--security-opt=no-new-privileges:true`, and `--network=none` during the `build` stage.
- **Process Timeouts & Output Quotas**: `BUILD_TIMEOUT_MS` (default `180000` ms) kills runaway process trees; `BUILD_MAX_OUTPUT_BYTES` (default `52428800` bytes) caps bundle size; symlinks escaping the output directory are skipped.
- **Cleanup**: Temporary workspaces under `os.tmpdir()/qh-builds/<deploymentId>` are always removed inside `finally`.
